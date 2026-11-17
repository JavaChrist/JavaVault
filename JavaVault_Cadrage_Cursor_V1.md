# JavaVault — Cadre de réalisation V1 pour Cursor

## Mission

Construire une nouvelle application personnelle pour Christian (JavaChrist), sans reprendre automatiquement l’architecture de l’ancien JavaVault. Le précédent projet a été supprimé car il était devenu trop complexe. La priorité est une application simple, utilisable et terminée.

Usage principal : sur un autre poste, Christian clone son projet depuis GitHub, ouvre JavaVault, récupère son `.env.local`, ses clés et ses fichiers JSON, puis reprend le développement. JavaVault ne clone pas GitHub et ne configure pas les services à sa place.

## Périmètre ferme

Un seul utilisateur autorisé, un coffre personnel contenant plusieurs projets. Interface française, React + TypeScript + Vite, PWA responsive. Utiliser des versions stables compatibles et vérifier leur documentation officielle pendant l’implémentation. Pas de Next.js ni de serveur applicatif supplémentaire sans besoin démontré.

Christian possède déjà les icônes de l’application. Lui demander leur emplacement au moment nécessaire, puis les intégrer au manifeste, aux raccourcis et à l’icône Apple. Ne pas générer de nouveau logo, ne pas remplacer les icônes et ne pas utiliser celles de Cubelyo. Une icône maskable ne doit pas être déclarée comme telle sans vérifier ses marges.

## Fonctions V1

### Projets et rubriques

- Créer, renommer et supprimer un projet ; lien GitHub et note facultatifs.
- Rubriques initiales : Firebase, Supabase, Vercel, Google Cloud, API et services, Autres.
- Ajouter une rubrique simple si nécessaire, sans système de modèles ou de règles personnalisables.
- Entrée : nom exact, valeur ou contenu, rubrique, note facultative, dates de création/modification.
- Accepter clés API, URL, adresses de comptes de service, variables, clés privées multilignes et documents JSON.
- Recherche dans le coffre déverrouillé par projet, nom et rubrique ; ne pas indexer les secrets sur le serveur.

### Import et classement

- Importer `.env.local` par fichier ou collage ; analyse et classement exécutés sur l’appareil, sans IA ni appel externe.
- Proposer les rubriques d’après les préfixes et noms connus. Exemple : FIREBASE et FIREBASE_ADMIN vers Firebase, SUPABASE vers Supabase, VERCEL vers Vercel. En cas de doute : Autres, avec correction manuelle.
- Afficher un aperçu masqué avant enregistrement : noms, rubrique proposée, doublons et erreurs.
- Aucun écrasement silencieux : garder l’existant ou remplacer explicitement, variable par variable.
- Préserver les noms, valeurs, caractères spéciaux, guillemets et clés multilignes. Ne jamais exécuter le fichier, développer des variables ou interpréter du code shell.
- Conserver également l’original importé pour permettre son téléchargement exact. Si les variables sont modifiées ensuite, distinguer clairement « original importé » et « export actuel ».
- Importer un JSON complet en préservant ses octets et son nom ; proposer sa rubrique d’après son contenu, sans le découper automatiquement.
- Export `.env.local` complet ou sélection d’un groupe, avec sérialisation testée ; téléchargement du JSON original.
- Exporter en clair exige une action explicite et un bref rappel que le fichier contient des secrets. Aucun export automatique.

### Interface et habitudes attendues

- Bureau : projets dans une colonne, rubriques et entrées faciles à parcourir. Mobile : navigation adaptée, sans défilement horizontal.
- Thème sombre lisible, accents cyan discrets, composants sobres et cohérents. Pas de tableau de bord statistique ni de décoration envahissante.
- Valeurs secrètes masquées par défaut. Bouton œil accessible pour afficher/masquer ; idem pour phrase maître, confirmation et champs de mot de passe.
- Copier une valeur exacte ou un groupe, avec retour bref « Copié ». Ne pas promettre l’effacement automatique du presse-papiers : il n’est pas garanti selon le navigateur.
- Modales cohérentes : titre et fermeture visibles, contenu défilant, gestion du focus, clavier et restitution du focus. Confirmation pour suppression et abandon d’un formulaire modifié.
- États chargement, vide, erreur, hors ligne, synchronisation et conflit compréhensibles. Ne jamais afficher « sauvegardé » avant confirmation réelle.
- Bouton « Verrouiller », indicateur de synchronisation et numéro de version visibles dans les réglages.

## Sécurité indispensable dès le départ

Le coffre contient de vrais secrets de production. Réduire le périmètre fonctionnel, pas la protection des données.

- Chiffrement authentifié sur l’appareil avant toute écriture persistante ou synchronisation : contenu, noms des projets, rubriques, notes et fichiers inclus. Utiliser des primitives éprouvées (Web Crypto AES-GCM et dérivation de clé documentée), jamais un algorithme maison. Paramètres de dérivation, sel, nonce et format versionnés ; nonce unique à chaque chiffrement.
- Phrase maître jamais envoyée au serveur, ni persistée en clair. Clé déchiffrée uniquement en mémoire tant que le coffre est ouvert.
- Séparer connexion au stockage distant et déverrouillage du coffre. La réinitialisation du compte de connexion ne doit pas prétendre déchiffrer le coffre.
- Expliquer avant création qu’une phrase maître oubliée ne se récupère pas sans mécanisme prévu. V1 : phrase maître + export de secours chiffré ; pas de récupération administrateur ni de clé cachée.
- Verrouillage après 5 minutes d’inactivité par défaut et au rechargement/fermeture ; au verrouillage, retirer les contenus déchiffrés de l’état applicatif. Aucun mode « rester déverrouillé pour toujours ».
- Aucun secret ou phrase maître dans logs, URL, analytics, rapports d’erreur, captures de test ou fichiers Git. Utiliser uniquement des données fictives pour les tests.
- Pas de script tiers, analytics, publicité, police distante ou IA. Politique CSP adaptée ; aucun HTML importé exécuté.
- Le chiffrement ne protège pas d’un appareil compromis ou d’un code web compromis : ne pas promettre une sécurité absolue.

## Sauvegarde et synchronisation entre appareils

Choix V1 : Firebase Auth pour un compte personnel durable et Firestore pour le coffre chiffré. Aucun compte anonyme pour cet usage. Accès réservé à l’UID personnel autorisé, règles serveur refusant tout autre utilisateur ; masquer un bouton d’inscription ne constitue pas un contrôle d’accès. Aucun SDK Admin ni clé de compte de service dans la PWA.

- Un seul backend Firebase, hébergement statique Vercel. Ne pas ajouter Supabase en parallèle : Supabase est une rubrique du coffre, pas une dépendance nécessaire.
- Stockage local IndexedDB chiffré pour reprise et consultation hors ligne après une première synchronisation. Ni secret déchiffré ni clé maître dans localStorage ou les caches du service worker.
- Authentification depuis les différents appareils, puis déverrouillage avec la même phrase maître.
- Synchronisation avec numéro de révision et contrôle transactionnel. Une modification distante ne doit jamais être écrasée silencieusement par une copie ancienne.
- En conflit : conserver les deux versions chiffrées et proposer un choix explicite après déverrouillage. Pas de moteur de fusion sophistiqué.
- Afficher les modifications en attente hors ligne ; ne pas les perdre au redémarrage.
- Export de secours complet chiffré et import de restauration, format versionné. Tester la restauration sur un navigateur neuf : la synchronisation seule n’est pas une sauvegarde de secours.

## PWA et mises à jour

- Installable en HTTPS sur les navigateurs compatibles ; consignes manuelles si le navigateur ne propose pas l’installation automatique.
- Manifeste, icônes existantes, mode standalone, responsive PC/portable/mobile.
- Service worker limité à l’interface et aux ressources statiques nécessaires ; aucune mise en cache de réponse contenant des secrets en clair.
- Nouvelle version détectée : modale « Une mise à jour est disponible », boutons « Mettre à jour » et « Plus tard ».
- Aucun rechargement forcé pendant une saisie, un import ou une synchronisation. Avant mise à jour : modifications persistées localement sous forme chiffrée, avertissement si opération en cours, puis rechargement et coffre verrouillé.
- Purger les anciens caches applicatifs sans supprimer IndexedDB ni le coffre.

## Hors périmètre

Pas d’équipes, partage, rôles multiples, abonnements, facturation, extension navigateur, remplissage automatique, accès aux consoles fournisseurs, lecture des fichiers du PC sans sélection explicite, synchronisation GitHub, rotation de clés, génération d’API keys, agent IA ou audit des projets. Pas de nouveaux services ou nouvelle architecture pour anticiper une hypothétique V2.

## Livraison en trois lots

1. Interface et coffre local chiffré : projets, rubriques, saisie, import, copie et export de secours. Tester avec de faux secrets.
2. Compte personnel et synchronisation chiffrée : reprise sur un deuxième navigateur, coupure réseau et conflit de révisions.
3. PWA, icônes fournies, modale de mise à jour et vérification finale PC/portable/mobile.

Pour chaque lot : implémenter, exécuter les vérifications pertinentes, présenter un résultat essayable et un bilan bref. Ne pas demander confirmation pour chaque fichier, dépendance nécessaire ou correction ordinaire. Demander seulement les informations manquantes indispensables ou un changement de périmètre. Toute idée supplémentaire va dans une courte liste « Plus tard » et ne devient pas une tâche automatique.

## Conditions de fin V1

- Un `.env.local` fictif et un JSON importés sont récupérés sans altération ; accents, #, =, guillemets, espaces et clés multilignes couverts.
- Un doublon n’écrase rien sans décision explicite.
- Mauvaise phrase maître : aucun contenu révélé. Modification d’un coffre chiffré détectée et refusée.
- Absence de secrets en clair vérifiée dans stockage persistant, requêtes de synchronisation et journaux.
- Un utilisateur non autorisé ne peut ni lire ni écrire le coffre distant.
- Export chiffré restauré sur un navigateur neuf ; modifications simultanées sans perte silencieuse.
- Installation PWA et mise à jour sans perte de saisie ni de données.
- Parcours complet : cloner un projet manuellement depuis GitHub, ouvrir JavaVault sur le portable, récupérer sa configuration et lancer le projet avec les fichiers restitués.

Fournir un README court : installation, variables publiques de configuration, règles Firebase, déploiement, utilisation et sauvegarde/restauration. Ne jamais livrer de secrets réels dans la documentation.

Commencer par inspecter le dossier de travail et les instructions existantes, résumer l’architecture retenue en dix lignes maximum, puis réaliser le lot 1. Ne pas écraser un dossier ou un dépôt existant sans vérifier sa destination.
