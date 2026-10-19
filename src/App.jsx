import React, { useEffect, useState, useRef } from 'react';
import useMapStore from './store/useMapStore';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import BottomPanel from './components/BottomPanel';
import MarsMap from './components/MarsMap';
import Mars3DViewer from './components/Mars3DViewer';
import LoadingScreen from './components/LoadingScreen';
import EVAHelmetHUD from './components/EVAHelmetHUD';
import ScienceLabModal from './components/ScienceLabModal';
import FlightPlanModal from './components/FlightPlanModal';
import MartianSkyEphemeris from './components/MartianSkyEphemeris';
import AudioSynthesizerRack from './components/AudioSynthesizerRack';
import ContingencySimulator from './components/ContingencySimulator';
import ErrorBoundary from './components/ErrorBoundary';
import SpaceAtmosphere from './components/SpaceAtmosphere';
import RightSidebar from './components/RightSidebar';
import MarsImageryModal from './components/MarsImageryModal';
import HomeHero from './components/HomeHero';
import AuthModal from './components/AuthModal';
import UserProfileDashboard from './components/UserProfileDashboard';
import AresCopilotModal from './components/AresCopilotModal';
import AresFloatingButton from './components/AresFloatingButton';
import ScienceLabPage from './components/ScienceLabPage';
import MarsImageryPage from './components/MarsImageryPage';
import ContingencySimulatorPage from './components/ContingencySimulatorPage';
import { supabase } from './lib/supabase';

import { Radar, ChevronLeft, Camera, FlaskConical, Sparkles, Image } from 'lucide-react';

function App() {
  const viewMode = useMapStore(s => s.viewMode);
  const showLoadingScreen = useMapStore(s => s.showLoadingScreen);
  const rightSidebarOpen = useMapStore(s => s.rightSidebarOpen);
  const setRightSidebarOpen = useMapStore(s => s.setRightSidebarOpen);
  const isScienceLabOpen = useMapStore(s => s.isScienceLabOpen);
  const setScienceLabOpen = useMapStore(s => s.setScienceLabOpen);
  const isImageryModalOpen = useMapStore(s => s.isImageryModalOpen);
  const setImageryModalOpen = useMapStore(s => s.setImageryModalOpen);
  const isContingencyModalOpen = useMapStore(s => s.isContingencyModalOpen);
  const setContingencyModalOpen = useMapStore(s => s.setContingencyModalOpen);
  const activeTab = useMapStore(s => s.activeTab);
  const setActiveTab = useMapStore(s => s.setActiveTab);
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
  }, []);

  const fetchProfile = async (userId) => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (data) setProfile(data);
    } catch (e) {
      console.warn("Could not fetch profile:", e);
    }
  };

  // Update weather data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      useMapStore.getState().updateWeather();
    }, 60000); // Every 60 seconds
    return () => clearInterval(interval);
  }, []);

  // Close any lingering modals when switching main tabs
  useEffect(() => {
    setScienceLabOpen(false);
    setImageryModalOpen(false);
    setContingencyModalOpen(false);
  }, [activeTab]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#050608] selection:bg-mars-400/40 selection:text-white relative font-sans">
      {/* GLOBAL ATMOSPHERE & LOADING SCREEN */}
      <SpaceAtmosphere />
      {showLoadingScreen && <LoadingScreen />}
      <AuthModal />
      <UserProfileDashboard />

      {/* TOP NAVIGATION BAR */}
      <TopBar onSelectTab={(tab) => setActiveTab(tab)} />

      {/* ======================================================== */}
      {/* DEDICATED SCREEN VIEWS                                   */}
      {/* ======================================================== */}
      <main className="w-full h-full relative">
        {/* TAB 1: MISSION HUB & OVERVIEW */}
        {activeTab === 'home' && (
          <div className="w-full h-screen overflow-y-auto overflow-x-hidden relative bg-[#040508] custom-scrollbar">
            <HomeHero onSelectTab={(tab) => setActiveTab(tab)} />
          </div>
        )}

        {/* TAB 2: INTERACTIVE MARS MAP & 3D CARTOGRAPHY */}
        {activeTab === 'map' && (
          <div 
            className="h-screen w-full flex flex-col relative overflow-hidden"
            style={{ backgroundImage: "url('/background.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
          >
            {/* Full-Bleed Edge-to-Edge Mars 3D Globe & Map Viewport */}
            <div className="absolute inset-0 z-0 overflow-hidden">
              <ErrorBoundary>
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
              </ErrorBoundary>
            </div>

            {/* Floating UI Layer for Map Section */}
            <div className="relative z-10 flex flex-col h-full w-full pointer-events-none pt-20">
              <div className="flex-1 flex overflow-hidden justify-end p-4 gap-4">
                <div className="pointer-events-auto h-full flex flex-col items-end">
                  <ErrorBoundary>
                    <RightSidebar />
                  </ErrorBoundary>

                  {!rightSidebarOpen && (
                    <button
                      onClick={() => setRightSidebarOpen(true)}
                      className="mt-auto mb-auto bg-[#0B0C10]/95 border border-cyber-cyan/40 hover:border-cyber-cyan hover:bg-space-900 text-cyber-cyan px-2 py-4 rounded-xl shadow-hud-glass cursor-pointer transition-all flex flex-col items-center gap-2 group backdrop-blur-md"
                      title="Open HUD Telemetry Feed"
                    >
                      <Radar className="w-4 h-4 text-cyber-cyan group-hover:scale-110 transition-transform animate-pulse" />
                      <ChevronLeft className="w-4 h-4 text-space-400 group-hover:text-cyber-cyan" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* FIXED LEFT SIDEBAR */}
            <div className="fixed left-4 top-1/2 -translate-y-1/2 z-[400] pointer-events-none">
              <div className="pointer-events-auto flex flex-col">
                <ErrorBoundary>
                  <Sidebar />
                </ErrorBoundary>
              </div>
            </div>

            {/* FIXED BOTTOM PANEL */}
            <div className="fixed bottom-0 left-0 right-0 pointer-events-none z-50 w-full px-4 pb-3 flex justify-center">
              <div className="pointer-events-auto w-full max-w-2xl flex justify-center">
                <ErrorBoundary>
                  <BottomPanel />
                </ErrorBoundary>
              </div>
            </div>

            {/* Version Badge */}
            <div className="absolute bottom-1 right-1 text-[9px] text-space-600 font-mono pointer-events-none select-none z-10">
              MarsWalk Explorer v2.5 • NASA Space Apps Challenge 2026
            </div>
          </div>
        )}

        {/* TAB 3: MARTIAN CELESTIAL SKY & EPHEMERIS */}
        {/* TAB 3: CELESTIAL EPHEMERIS & SOLAR TRANSIT */}
        {activeTab === 'sky' && (
          <div className="w-full h-screen overflow-y-auto overflow-x-hidden relative pt-24 px-6 sm:px-10 lg:px-14 custom-scrollbar bg-[#040508]">
            <ErrorBoundary>
              <MartianSkyEphemeris />
            </ErrorBoundary>
          </div>
        )}

        {/* TAB 4: SCIENCE LAB DIRECT FULL PAGE */}
        {activeTab === 'science' && (
          <div className="w-full h-screen overflow-y-auto overflow-x-hidden relative pt-24 px-6 sm:px-10 lg:px-14 custom-scrollbar bg-[#040508]">
            <ErrorBoundary>
              <ScienceLabPage />
            </ErrorBoundary>
          </div>
        )}

        {/* TAB 5: CONTINGENCY SIMULATOR DIRECT FULL PAGE */}
        {activeTab === 'contingency' && (
          <div className="w-full h-screen overflow-y-auto overflow-x-hidden relative pt-24 px-6 sm:px-10 lg:px-14 custom-scrollbar bg-[#040508]">
            <ErrorBoundary>
              <ContingencySimulatorPage />
            </ErrorBoundary>
          </div>
        )}

        {/* TAB 6: HiRISE SATELLITE & ROVER GALLERY DIRECT FULL PAGE */}
        {activeTab === 'imagery' && (
          <div className="w-full h-screen overflow-y-auto overflow-x-hidden relative pt-24 px-6 sm:px-10 lg:px-14 custom-scrollbar bg-[#040508]">
            <ErrorBoundary>
              <MarsImageryPage />
            </ErrorBoundary>
          </div>
        )}
      </main>

      {/* GLOBAL MODALS (Fixed overlays) */}
      <ErrorBoundary>
        <ScienceLabModal />
      </ErrorBoundary>
      <ErrorBoundary>
        <MarsImageryModal />
      </ErrorBoundary>
      <ErrorBoundary>
        <EVAHelmetHUD />
      </ErrorBoundary>
      <ErrorBoundary>
        <FlightPlanModal />
      </ErrorBoundary>
      <ErrorBoundary>
        <AudioSynthesizerRack />
      </ErrorBoundary>
      <ErrorBoundary>
        <ContingencySimulator />
      </ErrorBoundary>
      <ErrorBoundary>
        <AresCopilotModal />
      </ErrorBoundary>
      <AresFloatingButton />
    </div>
  );
}

export default App;
