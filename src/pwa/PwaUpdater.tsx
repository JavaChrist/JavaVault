// Gestion des mises à jour de la PWA.
//
// - Mode « prompt » : aucune mise à jour forcée. Une nouvelle version déclenche
//   une modale « Une mise à jour est disponible » (Mettre à jour / Plus tard).
// - Avant rechargement : les modifications sont déjà persistées localement sous
//   forme chiffrée (à chaque édition) ; on verrouille le coffre, puis on
//   recharge. Rien n'est rechargé pendant une saisie/un import/une synchro sans
//   action explicite de l'utilisateur.

import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/ToastProvider";
import { useVault } from "@/vault/VaultContext";

export function PwaUpdater() {
  const toast = useToast();
  const { lock } = useVault();
  const [applying, setApplying] = useState(false);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Vérification périodique : l'app ouverte détecte seule une nouvelle
      // version (sinon le contrôle n'a lieu qu'au rechargement de page).
      const checkForUpdate = () => {
        if (navigator.onLine) void registration.update();
      };
      setInterval(checkForUpdate, 60_000);
      // Vérifie aussi quand l'app revient au premier plan.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
    },
    onRegisterError(error) {
      // Enregistrement du service worker impossible : l'app reste utilisable.
      console.warn("Service worker non enregistré :", error);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      toast.show("Prêt à fonctionner hors ligne", "info");
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady, toast]);

  if (!needRefresh) return null;

  const applyUpdate = () => {
    // Idempotent : un seul passage, pour éviter les rechargements multiples
    // (cause de la page blanche observée) si l'utilisateur clique plusieurs fois.
    if (applying) return;
    setApplying(true);
    // Sécurité : on verrouille le coffre avant le rechargement de la page.
    try {
      lock();
    } catch {
      /* lock ne doit jamais empêcher la mise à jour */
    }
    // Active le nouveau SW (SKIP_WAITING). Le rechargement est déclenché UNE
    // seule fois par `controllerchange` (clientsClaim fait prendre le contrôle
    // au nouveau SW). Pas de reload « en aveugle » : il rechargeait parfois des
    // assets déjà purgés → page blanche.
    void updateServiceWorker(true);
  };

  return (
    <Modal
      title="Une mise à jour est disponible"
      maxWidth={440}
      dismissible={false}
      onClose={() => setNeedRefresh(false)}
      footer={
        <>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            disabled={applying}
          >
            Plus tard
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={applyUpdate}
            disabled={applying}
          >
            {applying ? "Mise à jour…" : "Mettre à jour"}
          </button>
        </>
      }
    >
      <p style={{ lineHeight: 1.5 }}>
        Une nouvelle version de JavaVault est prête. Vos modifications sont déjà
        enregistrées (chiffrées) sur cet appareil.
      </p>
      <p className="muted text-sm">
        La mise à jour recharge l'application et <b>verrouille le coffre</b> :
        vous devrez ressaisir votre phrase maître. Choisissez « Plus tard » si
        vous êtes en pleine saisie, un import ou une synchronisation.
      </p>
    </Modal>
  );
}
