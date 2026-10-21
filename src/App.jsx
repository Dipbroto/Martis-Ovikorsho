import { useEffect, lazy, Suspense } from 'react';
import useMapStore from './store/useMapStore';
import TopBar from './components/TopBar';
import LoadingScreen from './components/LoadingScreen';
import ContingencySimulator from './components/ContingencySimulator';
import ErrorBoundary from './components/ErrorBoundary';
import SpaceAtmosphere from './components/SpaceAtmosphere';
import HomeHero from './components/HomeHero';
import MountOnFirstOpen from './components/MountOnFirstOpen';
import { supabase } from './lib/supabase';
import { fetchProfile } from './services/profileService';


// Everything below is split into its own chunk and only downloaded when it is first needed
const Sidebar = lazy(() => import('./components/Sidebar'));
const BottomPanel = lazy(() => import('./components/BottomPanel'));
const MapToolbar = lazy(() => import('./components/MapToolbar'));
const MapWelcome = lazy(() => import('./components/MapWelcome'));
const MarsMap = lazy(() => import('./components/MarsMap'));
const Mars3DViewer = lazy(() => import('./components/Mars3DViewer'));
const MartianSkyEphemeris = lazy(() => import('./components/MartianSkyEphemeris'));
const ScienceLabPage = lazy(() => import('./components/ScienceLabPage'));
const MarsImageryPage = lazy(() => import('./components/MarsImageryPage'));
const ContingencySimulatorPage = lazy(() => import('./components/ContingencySimulatorPage'));

const ScienceLabModal = lazy(() => import('./components/ScienceLabModal'));
const MarsImageryModal = lazy(() => import('./components/MarsImageryModal'));
const EVAHelmetHUD = lazy(() => import('./components/EVAHelmetHUD'));
const FlightPlanModal = lazy(() => import('./components/FlightPlanModal'));
const AudioSynthesizerRack = lazy(() => import('./components/AudioSynthesizerRack'));
const AresCopilotModal = lazy(() => import('./components/AresCopilotModal'));
const AresFloatingButton = lazy(() => import('./components/AresFloatingButton'));
const AuthModal = lazy(() => import('./components/AuthModal'));
const UserProfileDashboard = lazy(() => import('./components/UserProfileDashboard'));
const DataMethodsModal = lazy(() => import('./components/DataMethodsModal'));
const GuidedPlannerModal = lazy(() => import('./components/GuidedPlannerModal'));

const ViewFallback = () => (
  <div className="w-full h-full flex items-center justify-center text-[11px] font-mono tracking-widest text-space-400 animate-pulse">
    LOADING SUBSYSTEM...
  </div>
);

// Shared shell for the full-page tabs
const ScrollPage = ({ children }) => (
  <div className="w-full h-screen overflow-y-auto overflow-x-hidden relative pt-24 px-6 sm:px-10 lg:px-14 custom-scrollbar bg-[#040508]">
    <ErrorBoundary>
      <Suspense fallback={<ViewFallback />}>{children}</Suspense>
    </ErrorBoundary>
  </div>
);

function App() {
  const viewMode = useMapStore(s => s.viewMode);
  const showLoadingScreen = useMapStore(s => s.showLoadingScreen);
  const activeTab = useMapStore(s => s.activeTab);
  const setActiveTab = useMapStore(s => s.setActiveTab);
  const isScienceLabOpen = useMapStore(s => s.isScienceLabOpen);
  const isImageryModalOpen = useMapStore(s => s.isImageryModalOpen);
  const isEVASimulating = useMapStore(s => s.isEVASimulating);
  const isFlightPlanOpen = useMapStore(s => s.isFlightPlanOpen);
  const isAudioRackOpen = useMapStore(s => s.isAudioRackOpen);
  const isAresCopilotOpen = useMapStore(s => s.isAresCopilotOpen);
  const isAuthModalOpen = useMapStore(s => s.isAuthModalOpen);
  const isProfileModalOpen = useMapStore(s => s.isProfileModalOpen);
  const isDataMethodsOpen = useMapStore(s => s.isDataMethodsOpen);
  const isGuidedPlannerOpen = useMapStore(s => s.isGuidedPlannerOpen);
  const setUser = useMapStore(s => s.setUser);
  const setProfile = useMapStore(s => s.setProfile);

  // Initialize Supabase Auth
  useEffect(() => {
    try {
      supabase.auth.getSession().then(({ data: { session } = {} } = {}) => {
        setUser(session?.user ?? null);
        if (session?.user) fetchProfile(session.user.id);
      }).catch(err => {
        console.warn("Auth session fetch error (offline mode):", err);
      });

      const { data: { subscription } = {} } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      }) || {};

      return () => subscription?.unsubscribe?.();
    } catch (e) {
      console.warn("Supabase auth init skipped:", e);
    }
  }, [setUser, setProfile]);

  // Update weather data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      useMapStore.getState().updateWeather();
    }, 60000); // Every 60 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#050608] selection:bg-mars-400/40 selection:text-white relative font-sans">
      {/* GLOBAL ATMOSPHERE & LOADING SCREEN */}
      <SpaceAtmosphere />
      {showLoadingScreen && <LoadingScreen />}
      <MountOnFirstOpen open={isAuthModalOpen}><AuthModal /></MountOnFirstOpen>
      <MountOnFirstOpen open={isProfileModalOpen}><UserProfileDashboard /></MountOnFirstOpen>
      <MountOnFirstOpen open={isDataMethodsOpen}><DataMethodsModal /></MountOnFirstOpen>
      <MountOnFirstOpen open={isGuidedPlannerOpen}><GuidedPlannerModal /></MountOnFirstOpen>

      {/* TOP NAVIGATION BAR */}
      <TopBar onSelectTab={(tab) => setActiveTab(tab)} />

      {/* ======================================================== */}
      {/* DEDICATED SCREEN VIEWS                                   */}
      {/* ======================================================== */}
      <main className="w-full h-full relative">
        {/* TAB 1: MISSION HUB & OVERVIEW */}
        {activeTab === 'home' && (
          <HomeHero onSelectTab={(tab) => setActiveTab(tab)} />
        )}

        {/* TAB 2: INTERACTIVE MARS MAP & 3D CARTOGRAPHY */}
        {activeTab === 'map' && (
          <div 
            className="h-screen w-full flex flex-col relative overflow-hidden"
            style={{ backgroundImage: "url('/background.webp')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
          >
            {/* Full-Bleed Edge-to-Edge Mars 3D Globe & Map Viewport */}
            <div className="absolute inset-0 z-0 overflow-hidden">
              <ErrorBoundary>
                <Suspense fallback={<ViewFallback />}>
                  {viewMode === '2d' && <MarsMap />}
                  {viewMode === '3d' && <Mars3DViewer />}
                  {viewMode === 'split' && (
                    <div className="absolute inset-0 flex">
                      <div className="w-1/2 h-full border-r border-space-700 relative">
                        <MarsMap />
                      </div>
                      <div className="w-1/2 h-full relative">
                        <Mars3DViewer />
                      </div>
                    </div>
                  )}
                </Suspense>
              </ErrorBoundary>
            </div>

            {/* Map controls: view, survival checks, layers, tools and route actions */}
            <ErrorBoundary>
              <Suspense fallback={null}>
                <MapToolbar />
                <MapWelcome />
              </Suspense>
            </ErrorBoundary>

            {/* FIXED LEFT SIDEBAR */}
            <div className="fixed left-3 top-[172px] sm:top-[150px] bottom-24 z-[400] pointer-events-none flex">
              <div className="pointer-events-auto flex flex-col min-h-0 max-h-full">
                <ErrorBoundary>
                  <Suspense fallback={null}>
                    <Sidebar />
                  </Suspense>
                </ErrorBoundary>
              </div>
            </div>

            {/* FIXED BOTTOM PANEL */}
            <div className="fixed bottom-0 left-0 right-0 pointer-events-none z-50 w-full px-4 pb-3 flex justify-center">
              <div className="pointer-events-auto w-full max-w-2xl flex justify-center">
                <ErrorBoundary>
                  <Suspense fallback={null}>
                    <BottomPanel />
                  </Suspense>
                </ErrorBoundary>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: CELESTIAL EPHEMERIS & SOLAR TRANSIT */}
        {activeTab === 'sky' && (
          <ScrollPage>
            <MartianSkyEphemeris />
          </ScrollPage>
        )}

        {/* TAB 4: SCIENCE LAB DIRECT FULL PAGE */}
        {activeTab === 'science' && (
          <ScrollPage>
            <ScienceLabPage />
          </ScrollPage>
        )}

        {/* TAB 5: CONTINGENCY SIMULATOR DIRECT FULL PAGE */}
        {activeTab === 'contingency' && (
          <ScrollPage>
            <ContingencySimulatorPage />
          </ScrollPage>
        )}

        {/* TAB 6: HiRISE SATELLITE & ROVER GALLERY DIRECT FULL PAGE */}
        {activeTab === 'imagery' && (
          <ScrollPage>
            <MarsImageryPage />
          </ScrollPage>
        )}
      </main>

      {/* GLOBAL MODALS (Fixed overlays) - each chunk loads the first time it is opened */}
      <ErrorBoundary>
        <MountOnFirstOpen open={isScienceLabOpen}><ScienceLabModal /></MountOnFirstOpen>
      </ErrorBoundary>
      <ErrorBoundary>
        <MountOnFirstOpen open={isImageryModalOpen}><MarsImageryModal /></MountOnFirstOpen>
      </ErrorBoundary>
      <ErrorBoundary>
        <MountOnFirstOpen open={isEVASimulating}><EVAHelmetHUD /></MountOnFirstOpen>
      </ErrorBoundary>
      <ErrorBoundary>
        <MountOnFirstOpen open={isFlightPlanOpen}><FlightPlanModal /></MountOnFirstOpen>
      </ErrorBoundary>
      <ErrorBoundary>
        <MountOnFirstOpen open={isAudioRackOpen}><AudioSynthesizerRack /></MountOnFirstOpen>
      </ErrorBoundary>
      <ErrorBoundary>
        <ContingencySimulator />
      </ErrorBoundary>
      <ErrorBoundary>
        <MountOnFirstOpen open={isAresCopilotOpen}><AresCopilotModal /></MountOnFirstOpen>
      </ErrorBoundary>
      <Suspense fallback={null}>
        <AresFloatingButton />
      </Suspense>
    </div>
  );
}

export default App;
