# groupe-couture.github.io

Page d'accueil statique (un seul `index.html`, CSS et SVG en ligne, aucune dépendance), même design que mdany75.github.io.
- Design « cartes colorées » ; thème clair/sombre automatique.
- Ajouter une application : copier un bloc `<div class="card ...">` dans le `<nav>`. Le lien du `<h2>` couvre la carte (site en ligne) ; le lien `.code` mène au dépôt GitHub.
- Dépôt public : jamais de code, de clé ni de configuration des applications ici.
- Textes en français. Pas de build : tester avec `python3 -m http.server`.
- `levis-subaru/` : copie du dossier `public/` du dépôt privé groupe-couture/levis-subaru. Ne pas le modifier ici : corriger dans levis-subaru, puis recopier (`rsync -a --delete public/ levis-subaru/`).
- `.nojekyll` à la racine : GitHub Pages sert les fichiers tels quels.
