# IBS-CHAT SOCIAL — projet de départ Android + Web

Isaac, ce ZIP contient un **projet de départ réel**, pas un APK déjà compilé ni un service déjà hébergé. Les vrais comptes, les messages synchronisés et les vocaux ne fonctionneront qu'après configuration de Firebase et création des builds.

## Fonctions incluses dans cette base
- Inscription et connexion par e-mail/mot de passe.
- Profil modifiable (nom, bio et photo).
- Liste des utilisateurs inscrits.
- Messages texte en temps réel.
- Enregistrement vocal, envoi dans Firebase Storage et lecture.
- Paramètres, mode basique simplifié, page « À propos / Mon histoire ».
- Badge bleu affiché si le compte connecté utilise l'adresse du fondateur configurée dans `App.js`.

## Important sur le badge
Le badge est uniquement une logique d'interface dans cette version. Pour empêcher toute usurpation, il faut créer une attribution de rôle côté serveur (par exemple Firebase Custom Claims via une fonction Admin sécurisée) et ne jamais permettre à l'application de s'attribuer elle-même le badge. Le numéro fourni dans le code n'est pas une preuve de propriété et n'est pas utilisé pour authentifier le compte. Ne partagez pas publiquement votre numéro personnel.

## 1. Configurer Firebase
1. Ouvrez la console Firebase et créez un projet `IBS-CHAT-SOCIAL`.
2. Ajoutez une application Web et copiez les paramètres dans `firebase.js`.
3. Activez Authentication > Sign-in method > Email/Password.
4. Créez Firestore Database.
5. Activez Storage.
6. Dans les règles Firestore et Storage, publiez les règles fournies ici. Faites-les relire avant un lancement public : elles constituent une base de départ, pas un audit de sécurité.
7. Pour utiliser le vrai numéro de téléphone et les codes SMS, activez Phone Authentication et ajoutez le flux OTP. Ce projet n'implémente pas encore la vérification SMS.

## 2. Lancer sur Android / ordinateur
Installez Node.js LTS sur un ordinateur, puis ouvrez un terminal dans le dossier du projet :
```bash
npm install
npx expo start
```
Scannez le QR avec Expo Go pour tester sur Android. Pour tester dans le navigateur :
```bash
npm run web
```
Le navigateur doit être sécurisé (HTTPS ou localhost) pour les fonctions micro dans la plupart des cas.

## 3. Construire un APK Android
Connectez-vous à un compte Expo puis lancez :
```bash
npx eas-cli login
npx eas-cli build:configure
npm run build:android
```
Le service de build produira un lien de téléchargement APK lorsque la compilation sera terminée. Il n'y a pas d'APK précompilé dans ce ZIP.

## 4. Ordinateur Windows (.exe)
Cette base peut être testée dans un navigateur. Elle ne contient pas encore de paquet Windows `.exe`. Pour créer une vraie application Windows installable, il faut ajouter et configurer un conteneur desktop (par exemple Electron ou Tauri), tester le microphone, les mises à jour et la sécurité, puis construire l'installateur sur un environnement adapté.

## Limites à corriger avant lancement public
- Authentification SMS/OTP non incluse.
- Badge vérifié à sécuriser côté serveur avant de l'annoncer comme inviolable.
- Les notifications push, les messages d'accueil/absence, le catalogue, les étiquettes, les groupes et les statuts ne sont pas encore implémentés.
- La recherche de messages, le blocage/signalement, la suppression de compte, les sauvegardes et le chiffrement de bout en bout ne sont pas implémentés.
- Le mode basique ne rend pas les messages gratuits : les audios et photos utilisent toujours des données.
- Ne publiez pas l'application auprès du grand public avant tests, règles de sécurité et politique de confidentialité.

## À propos du fondateur
La page est dans Paramètres > À propos de l'application / Mon histoire. Elle n'apparaît pas sur la page d'accueil.
