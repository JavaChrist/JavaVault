import "./app-layout.css";
import { ConfirmProvider } from "@/components/ConfirmProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { VaultProvider, useVault } from "@/vault/VaultContext";
import { SyncProvider } from "@/sync/SyncContext";
import { PwaUpdater } from "@/pwa/PwaUpdater";
import { LockScreen } from "@/screens/LockScreen";
import { VaultScreen } from "@/screens/VaultScreen";

function Gate() {
  const { status } = useVault();

  if (status === "loading") {
    return (
      <div className="lock-screen">
        <p className="muted">Chargement du coffre…</p>
      </div>
    );
  }
  if (status === "unlocked") return <VaultScreen />;
  return <LockScreen />;
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <VaultProvider>
          <SyncProvider>
            <Gate />
            <PwaUpdater />
          </SyncProvider>
        </VaultProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
