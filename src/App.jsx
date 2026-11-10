import { useEffect, Suspense } from 'react';
import lazyWithRetry from './utils/lazyWithRetry';
import useEscapeBack from './utils/useEscapeBack';
import useMapStore from './store/useMapStore';
import TopBar from './components/TopBar';
import LoadingScreen from './components/LoadingScreen';
import ContingencySimulator from './components/ContingencySimulator';
import { prefetchImagery } from './services/nasaApiService';
import ErrorBoundary from './components/ErrorBoundary';
import SpaceAtmosphere from './components/SpaceAtmosphere';
import HomeHero from './components/HomeHero';
import MountOnFirstOpen from './components/MountOnFirstOpen';
import { supabase } from './lib/supabase';
import { fetchProfile } from './services/profileService';
import { getUnreadCommsCount, subscribeToCrewComms } from './services/crewCommsService';


// Everything below is split into its own chunk and only downloaded when it is first needed
const Sidebar = lazyWithRetry(() => import('./components/Sidebar'));
const BottomPanel = lazyWithRetry(() => import('./components/BottomPanel'));
const MapToolbar = lazyWithRetry(() => import('./components/MapToolbar'));
const MarsMap = lazyWithRetry(() => import('./components/MarsMap'));
const Mars3DViewer = lazyWithRetry(() => import('./components/Mars3DViewer'));
const MartianSkyEphemeris = lazyWithRetry(() => import('./components/MartianSkyEphemeris'));
const ScienceLabPage = lazyWithRetry(() => import('./components/ScienceLabPage'));
const MarsImageryPage = lazyWithRetry(() => import('./components/MarsImageryPage'));
const ContingencySimulatorPage = lazyWithRetry(() => import('./components/ContingencySimulatorPage'));

const MarsImageryModal = lazyWithRetry(() => import('./components/MarsImageryModal'));
const EVAHelmetHUD = lazyWithRetry(() => import('./components/EVAHelmetHUD'));
const FlightPlanModal = lazyWithRetry(() => import('./components/FlightPlanModal'));
const AudioSynthesizerRack = lazyWithRetry(() => import('./components/AudioSynthesizerRack'));
const AresCopilotModal = lazyWithRetry(() => import('./components/AresCopilotModal'));
const AresFloatingButton = lazyWithRetry(() => import('./components/AresFloatingButton'));
const AuthModal = lazyWithRetry(() => import('./components/AuthModal'));
const UserProfileDashboard = lazyWithRetry(() => import('./components/UserProfileDashboard'));
const CrewCommsModal = lazyWithRetry(() => import('./components/CrewCommsModal'));
const DataMethodsModal = lazyWithRetry(() => import('./components/DataMethodsModal'));
const GuidedPlannerModal = lazyWithRetry(() => import('./components/GuidedPlannerModal'));
const MartianStreetViewModal = lazyWithRetry(() => import('./components/MartianStreetViewModal'));

// While the 3D code loads: the same dark space the globe sits in, so nothing flashes
const GlobeFallback = () => (
  <div className="w-full h-full bg-[#020306] flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <span className="w-10 h-10 rounded-full border-2 border-white/10 border-t-[#F26A3D] animate-spin" />
      <span className="text-xs text-zinc-400">Loading Mars…</span>
    </div>
  </div>
);

const ViewFallback = () => (
  <div className="w-full h-full flex items-center justify-center text-[11px] font-mono tracking-widest text-space-400 animate-pulse">
    LOADING SUBSYSTEM...
  </div>
);

// Shared shell for the full-page tabs
const ScrollPage = ({ children }) => (
  <div data-page-scroll className="w-full h-screen overflow-y-auto overflow-x-hidden relative pt-20 sm:pt-24 px-3 sm:px-8 lg:px-14 custom-scrollbar bg-[#040508]">
    <ErrorBoundary>
      <Suspense fallback={<ViewFallback />}>{children}</Suspense>
    </ErrorBoundary>
  </div>
);

function App() {
  const toolbarCollapsed = useMapStore(s => s.toolbarCollapsed);
  const viewMode = useMapStore(s => s.viewMode);
  const showLoadingScreen = useMapStore(s => s.showLoadingScreen);
  const activeTab = useMapStore(s => s.activeTab);
  const setActiveTab = useMapStore(s => s.setActiveTab);
  const tabRefreshKeys = useMapStore(s => s.tabRefreshKeys || { home: 0, map: 0, science: 0, sky: 0, contingency: 0, imagery: 0 });
  const bottomPanelOpen = useMapStore(s => s.bottomPanelOpen);
  const isImageryModalOpen = useMapStore(s => s.isImageryModalOpen);
  const isStreetViewOpen = useMapStore(s => s.isStreetViewOpen);
  const isEVASimulating = useMapStore(s => s.isEVASimulating);
  const isFlightPlanOpen = useMapStore(s => s.isFlightPlanOpen);
  const isAudioRackOpen = useMapStore(s => s.isAudioRackOpen);
  const isAresCopilotOpen = useMapStore(s => s.isAresCopilotOpen);
  const isAuthModalOpen = useMapStore(s => s.isAuthModalOpen);
  const isProfileModalOpen = useMapStore(s => s.isProfileModalOpen);
  const isCrewCommsOpen = useMapStore(s => s.isCrewCommsOpen);
  const setUnreadCommsCount = useMapStore(s => s.setUnreadCommsCount);
  const user = useMapStore(s => s.user);
  const isDataMethodsOpen = useMapStore(s => s.isDataMethodsOpen);
  const isGuidedPlannerOpen = useMapStore(s => s.isGuidedPlannerOpen);
  const setUser = useMapStore(s => s.setUser);
  const setProfile = useMapStore(s => s.setProfile);

  // Track unread DSN Crew Comms messages and requests
  useEffect(() => {
    if (!user) {
      setUnreadCommsCount(0);
      return;
    }
    getUnreadCommsCount(user.id).then((count) => setUnreadCommsCount(count));
    const unsub = subscribeToCrewComms(user.id, () => {
      getUnreadCommsCount(user.id).then((count) => setUnreadCommsCount(count));
    });
    return () => unsub?.();
  }, [user, setUnreadCommsCount]);

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

  // Shortly after the app opens, quietly warm up the gallery: its code, and the first search it shows
  useEffect(() => {
    const id = setTimeout(() => {
      const idle = window.requestIdleCallback || ((fn) => fn());
      idle(() => {
        import('./components/MarsImageryPage').catch(() => {});
        prefetchImagery('Jezero Crater Mars');
      });
    }, 4000);
    return () => clearTimeout(id);
  }, []);

  // Once the map is open, quietly fetch what the 3D globe needs, so switching to 3D is instant
  useEffect(() => {
    if (activeTab !== 'map') return undefined;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    const cancel = window.cancelIdleCallback || clearTimeout;
    const id = idle(() => {
      import('./components/Mars3DViewer').catch(() => {});
      new Image().src = '/textures/mars-viking-mdim21-4k.jpg';
      // The same for Surface 3D: NASA's landing app is a 3 MB script that takes a while on first load
      import('./components/MartianStreetViewModal').catch(() => {});
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = 'https://eyes.nasa.gov/apps/mars2020/script.js';
      document.head.appendChild(link);
    });
    return () => cancel(id);
  }, [activeTab]);

  // Esc always goes back one step, whatever has focus
  useEscapeBack();

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
      <MountOnFirstOpen open={isCrewCommsOpen}><CrewCommsModal /></MountOnFirstOpen>
      <MountOnFirstOpen open={isDataMethodsOpen}><DataMethodsModal /></MountOnFirstOpen>
      <MountOnFirstOpen open={isGuidedPlannerOpen}><GuidedPlannerModal /></MountOnFirstOpen>

      {/* TOP NAVIGATION BAR */}
      <TopBar onSelectTab={(tab) => setActiveTab(tab)} />

      {/* ======================================================== */}
      {/* DEDICATED SCREEN VIEWS                                   */}
      {/* ======================================================== */}
      {/* Nothing behind the full-screen surface view needs painting while NASA's app is running */}
      <main className={`w-full h-full relative ${isStreetViewOpen ? 'invisible' : ''}`}>
        {/* TAB 1: MISSION HUB & OVERVIEW */}
        <div
          key={`tab-home-${tabRefreshKeys.home}`}
          className={activeTab === 'home' ? 'w-full h-full' : 'hidden'}
          aria-hidden={activeTab !== 'home'}
        >
          <ErrorBoundary>
            {/* setActiveTab is a stable store action, so the memoised Home page is not re-rendered on every tab switch */}
            <HomeHero onSelectTab={setActiveTab} />
          </ErrorBoundary>
        </div>

        {/* TAB 2: INTERACTIVE MARS MAP & 3D CARTOGRAPHY */}
        <div
          key={`tab-map-${tabRefreshKeys.map}`}
          className={activeTab === 'map' ? 'w-full h-full' : 'hidden'}
          aria-hidden={activeTab !== 'map'}
        >
          <MountOnFirstOpen open={activeTab === 'map'}>
            <div 
              className="h-screen w-full flex flex-col relative overflow-hidden"
              style={viewMode === '2d' ? { backgroundImage: "url('/background.webp')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : { background: '#020306' }}
            >
              {/* Full-Bleed Edge-to-Edge Mars 3D Globe & Map Viewport */}
              <div className="absolute inset-0 z-0 overflow-hidden">
                <ErrorBoundary>
                  <Suspense fallback={viewMode === '2d' ? <ViewFallback /> : <GlobeFallback />}>
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
                </Suspense>
              </ErrorBoundary>

              {/* FIXED LEFT SIDEBAR */}
              <div
                className={`fixed left-3 z-[400] pointer-events-none flex flex-col items-start transition-[top,bottom] duration-300 ${toolbarCollapsed ? 'top-[132px]' : 'top-[172px] sm:top-[150px]'} ${bottomPanelOpen ? 'bottom-[318px] sm:bottom-6' : 'bottom-6'}`}
                style={{
                  maxHeight: `calc(100dvh - ${toolbarCollapsed ? 140 : 160}px - ${bottomPanelOpen ? (typeof window !== 'undefined' && window.innerWidth < 640 ? 325 : 36) : 36}px)`,
                }}
              >
                <div
                  className="pointer-events-auto flex flex-col min-h-0 h-full max-h-full"
                  style={{ maxHeight: '100%', height: '100%' }}
                >
                  <ErrorBoundary>
                    <Suspense fallback={null}>
                      <Sidebar />
                    </Suspense>
                  </ErrorBoundary>
                </div>
              </div>

              {/* FIXED BOTTOM PANEL */}
              <div className="fixed bottom-0 left-0 right-0 pointer-events-none z-[450] w-full px-4 pb-3 flex justify-center">
                <div className="pointer-events-auto w-full max-w-2xl flex justify-center">
                  <ErrorBoundary>
                    <Suspense fallback={null}>
                      <BottomPanel />
                    </Suspense>
                  </ErrorBoundary>
                </div>
              </div>

            </div>
          </MountOnFirstOpen>
        </div>

        {/* TAB 3: CELESTIAL EPHEMERIS & SOLAR TRANSIT */}
        <div
          key={`tab-sky-${tabRefreshKeys.sky}`}
          className={activeTab === 'sky' ? 'w-full h-full' : 'hidden'}
          aria-hidden={activeTab !== 'sky'}
        >
          <MountOnFirstOpen open={activeTab === 'sky'}>
            <ScrollPage>
              <MartianSkyEphemeris />
            </ScrollPage>
          </MountOnFirstOpen>
        </div>

        {/* TAB 4: SCIENCE LAB DIRECT FULL PAGE */}
        <div
          key={`tab-science-${tabRefreshKeys.science}`}
          className={activeTab === 'science' ? 'w-full h-full' : 'hidden'}
          aria-hidden={activeTab !== 'science'}
        >
          <MountOnFirstOpen open={activeTab === 'science'}>
            <ScrollPage>
              <ScienceLabPage />
            </ScrollPage>
          </MountOnFirstOpen>
        </div>

        {/* TAB 5: CONTINGENCY SIMULATOR DIRECT FULL PAGE */}
        <div
          key={`tab-contingency-${tabRefreshKeys.contingency}`}
          className={activeTab === 'contingency' ? 'w-full h-full' : 'hidden'}
          aria-hidden={activeTab !== 'contingency'}
        >
          <MountOnFirstOpen open={activeTab === 'contingency'}>
            <ScrollPage>
              <ContingencySimulatorPage />
            </ScrollPage>
          </MountOnFirstOpen>
        </div>

        {/* TAB 6: HiRISE SATELLITE & ROVER GALLERY DIRECT FULL PAGE */}
        <div
          key={`tab-imagery-${tabRefreshKeys.imagery}`}
          className={activeTab === 'imagery' ? 'w-full h-full' : 'hidden'}
          aria-hidden={activeTab !== 'imagery'}
        >
          <MountOnFirstOpen open={activeTab === 'imagery'}>
            <ScrollPage>
              <MarsImageryPage />
            </ScrollPage>
          </MountOnFirstOpen>
        </div>
      </main>

      {/* GLOBAL MODALS (Fixed overlays) - each chunk loads the first time it is opened */}
      <ErrorBoundary>
      </ErrorBoundary>
      <ErrorBoundary>
        <MountOnFirstOpen open={isImageryModalOpen}><MarsImageryModal /></MountOnFirstOpen>
      </ErrorBoundary>
      <ErrorBoundary>
        <MountOnFirstOpen open={isStreetViewOpen}><MartianStreetViewModal /></MountOnFirstOpen>
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
