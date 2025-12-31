import { useState, useEffect } from "react";
import { X, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      console.log("App is already installed");
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Check if user has dismissed the prompt before
      const hasSeenPrompt = localStorage.getItem("pwa-install-dismissed");
      if (!hasSeenPrompt && !isIOSDevice) {
        setTimeout(() => {
          setShowInstallPrompt(true);
        }, 2000); // Show after 2 seconds
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // For iOS, show install instructions if not in standalone mode
    if (isIOSDevice && !window.matchMedia("(display-mode: standalone)").matches) {
      const hasSeenIOSPrompt = localStorage.getItem("ios-install-dismissed");
      if (!hasSeenIOSPrompt) {
        setTimeout(() => {
          setShowInstallPrompt(true);
        }, 2000);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
    } else {
      console.log("User dismissed the install prompt");
    }

    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    if (isIOS) {
      localStorage.setItem("ios-install-dismissed", "true");
    } else {
      localStorage.setItem("pwa-install-dismissed", "true");
    }
  };

  if (!showInstallPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
          </div>

          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              Install Trainelo App
            </h3>

            {isIOS ? (
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                <p>Install this app on your iPhone:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Tap the share button <span className="inline-block w-4 h-4 align-text-bottom">⎋</span></li>
                  <li>Scroll and tap "Add to Home Screen"</li>
                  <li>Tap "Add" in the top right</li>
                </ol>
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Add Trainelo to your home screen for quick access and an app-like experience.
              </p>
            )}
          </div>

          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isIOS && (
          <div className="flex gap-2 mt-4">
            <Button
              onClick={handleInstallClick}
              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Install App
            </Button>
            <Button
              onClick={handleDismiss}
              variant="outline"
              className="flex-1"
            >
              Not Now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}