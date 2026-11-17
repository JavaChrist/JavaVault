# JavaVault

Coffre-fort personnel chiffré pour clés d'API, variables d'environnement et
fichiers de configuration (`.env.local`, JSON de comptes de service…).
Application React + TypeScript + Vite, PWA responsive, interface française.

> **V1 complète (lots 1, 2 & 3)** : coffre **local chiffré** (projets,
> rubriques, saisie, import `.env`/JSON, copie, export de secours chiffré),
> **synchronisation chiffrée entre appareils** (Firebase Auth + Firestore), et
> **PWA installable** avec mise à jour contrôlée et mode hors ligne.

## Sécurité en bref

- Chiffrement **AES-GCM 256** sur l'appareil, clé dérivée de la phrase maître
  par **PBKDF2-SHA-256** (310 000 itérations, sel + nonce versionnés).
- La phrase maître n'est **jamais** envoyée ni persistée. La clé déchiffrée
  reste **en mémoire** tant que le coffre est ouvert.
- Verrouillage automatique après **5 min** d'inactivité, au masquage et à la
  fermeture de l'onglet.
- Stockage **IndexedDB** ne contenant qu'un blob chiffré (aucun secret en clair
  en `localStorage`, cache ou logs).
- **Une phrase maître oubliée est irrécupérable.** Pas de récupération
  administrateur. Faites un export de secours chiffré.

## Installation

Prérequis : Node.js ≥ 18.

```bash
npm install
npm run dev        # serveur de développement (http://localhost:5173)
npm run build      # build de production dans dist/
npm run preview    # prévisualisation du build
npm run lint       # ESLint
npm run typecheck  # vérification des types
```

### Note Windows / Application Control

Sur un poste où une politique **Application Control (WDAC/AppLocker)** bloque les
binaires natifs dans le dossier utilisateur (ex. `Desktop`), le binaire natif de
Rollup est refusé. Ce projet contourne le problème en utilisant la version
**WebAssembly** de Rollup, via `overrides` dans `package.json` :

```json
"overrides": { "rollup": "npm:@rollup/wasm-node@^4.24.0" }
```

Aucune action supplémentaire n'est nécessaire : `npm install` applique l'override.

## Variables publiques de configuration

Le **lot 1 ne requiert aucune variable**. Pour le lot 2 (synchronisation
Firebase), copier `.env.example` vers `.env.local` et renseigner la
configuration **publique** du projet Firebase (préfixe `VITE_`). Ne jamais y
mettre de secret de production, de clé privée ou de compte de service.

Voir `.env.example` pour la liste des variables.

## Synchronisation (lot 2)

La synchronisation stocke le coffre **chiffré** dans Firestore (document
`vaults/{uid}` = enveloppe AES-GCM + numéro de révision). Le serveur ne voit
**jamais** de secret en clair.

- **Connexion ≠ déverrouillage** : on se connecte au compte Firebase
  (Réglages → Synchronisation, e-mail + mot de passe), puis on déverrouille le
  coffre avec la **phrase maître**. Ce sont deux secrets distincts.
- **Reprise sur un autre appareil** : se connecter → le coffre chiffré est
  tiré depuis Firestore → déverrouiller avec la même phrase maître.
- **Contrôle de révision transactionnel** : une copie ancienne n'écrase jamais
  silencieusement une version plus récente.
- **Conflit** (modifs des deux côtés) : les deux versions chiffrées sont
  conservées ; après déverrouillage, une modale propose un choix explicite
  (garder local / garder distant). Pas de fusion automatique.
- **Hors ligne** : les modifications sont persistées localement (chiffrées) et
  signalées « en attente » ; elles partent à la reconnexion.

### Configuration Firebase

1. Créer un projet Firebase, activer **Authentication → E-mail/Mot de passe** et
   **Firestore**.
2. Créer votre compte personnel, récupérer son **UID**.
3. Renseigner `.env.local` (voir `.env.example`) avec la config **publique**
   `VITE_FIREBASE_*` et `VITE_AUTHORIZED_UID` = votre UID.
4. Déployer les règles de `firestore.rules` en **remplaçant `AUTHORIZED_UID`**
   par votre UID :

```
firebase deploy --only firestore:rules
```

### Règles de sécurité

- Accès **réservé à l'UID autorisé** ; toute autre identité refusée côté
  règles serveur (masquer un bouton d'inscription ne suffit pas).
- Aucun SDK Admin ni clé de compte de service dans la PWA.
- Sans configuration Firebase, l'application reste **pleinement utilisable en
  local** ; la synchronisation est simplement « non configurée ».

## PWA (lot 3)

- **Installable** en HTTPS (manifeste + service worker + icônes fournies, mode
  `standalone`, responsive PC/portable/mobile sans défilement horizontal).
- **Mises à jour contrôlées** (mode `prompt`) : une nouvelle version déclenche
  une modale « Une mise à jour est disponible » (*Mettre à jour* / *Plus tard*).
  Aucun rechargement forcé ; au moment de la mise à jour, les modifications sont
  déjà persistées (chiffrées), le coffre est **verrouillé**, puis l'app recharge.
- Le service worker ne met en cache que l'interface et les ressources statiques.
  Les appels Firebase sont en `NetworkOnly`. Les anciens caches applicatifs sont
  purgés **sans** toucher à IndexedDB ni au coffre.
- Hors ligne : consultation après une première synchro, modifications chiffrées
  conservées et signalées « en attente ».

Si le navigateur ne propose pas l'installation automatique, utiliser le menu du
navigateur (« Installer l'application » / « Ajouter à l'écran d'accueil »).

## Déploiement

Hébergement **statique** (ex. Vercel) : publier le contenu de `dist/`.
**HTTPS obligatoire** pour l'installation PWA et le service worker. Aucune
fonction serveur nécessaire. Déployer aussi les règles `firestore.rules`.

Sur Vercel :
- Renseigner les variables `VITE_*` (lues **au build** → redéployer après ajout).
- Ajouter le domaine de déploiement dans **Firebase → Authentication → Authorized
  domains** (sinon `auth/unauthorized-domain`).
- Les en-têtes de sécurité et la **CSP** sont appliqués via `vercel.json`
  (self + endpoints Firebase uniquement ; aucun script tiers, analytics ou
  police distante).

## Utilisation

1. **Créer le coffre** : choisir une phrase maître (≥ 10 caractères) et la
   confirmer. Un avertissement rappelle qu'elle est irrécupérable.
2. **Projets** : créer un projet (nom, lien GitHub et note facultatifs).
3. **Entrées** : ajouter clés, variables, URL ou documents JSON ; rubrique
   proposée automatiquement, valeurs masquées par défaut (bouton œil, copie).
4. **Import** : coller ou choisir un `.env.local`/JSON ; analyse **locale**,
   aperçu masqué, classement par rubrique, doublons signalés (aucun écrasement
   silencieux). L'original est conservé pour un téléchargement exact.
5. **Export** : `.env` en clair (action explicite + rappel), téléchargement de
   l'original importé, ou **export de secours chiffré** de tout le coffre.
6. **Verrouiller** : bouton dédié + auto-verrouillage.

## Sauvegarde et restauration

- **Export de secours** (Exporter → « Export de secours ») : fichier JSON
  **chiffré** avec votre phrase maître, à conserver en lieu sûr.
- **Restauration** : depuis l'écran de verrouillage, « Restaurer un secours »,
  choisir le fichier et saisir la phrase maître d'origine.
- Tester la restauration sur un navigateur neuf : la synchronisation (lot 2)
  ne remplacera pas cette sauvegarde de secours.

## Structure

```
src/
  crypto/     Chiffrement AES-GCM + PBKDF2 (format versionné)
  storage/    IndexedDB (blob chiffré + révisions uniquement)
  vault/      Modèle, contexte (clé en mémoire), import .env, classement, secours
  firebase/   Initialisation conditionnelle (config publique VITE_*)
  sync/        Firestore (push transactionnel), SyncProvider, conflit, indicateur
  pwa/        Mise à jour du service worker (modale « mise à jour disponible »)
  components/ Modale, confirmation, toasts, champs secrets, icônes
  screens/    Écran de verrouillage et écran principal + modales
firestore.rules  Règles d'accès (UID autorisé unique)
```

> Aucune donnée réelle n'est fournie dans ce dépôt. Utiliser uniquement des
> secrets fictifs pour les tests.
