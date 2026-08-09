/**
 * Le port d'Abidjan au crépuscule.
 *
 * Dessinée à la main plutôt que générée. Les visuels produits par un outil
 * externe ne pouvaient pas être relus depuis cet environnement — les hôtes sont
 * filtrés — et le fondateur a jugé, à raison, que ce qui en sortait ne
 * représentait pas ce qu'il avait demandé. Un dessin en SVG se rend localement,
 * se regarde, se corrige : trois passes ont été nécessaires, et chacune a
 * réparé un défaut visible seulement à l'œil.
 *
 * Ce que ces passes ont appris, pour la prochaine illustration :
 *  - les silhouettes doivent être dessinées APRÈS le quai, sinon elles se
 *    tiennent derrière lui au lieu d'être dessus ;
 *  - une silhouette humaine tient en sept têtes. À quatre, elle se lit comme un
 *    bloc — c'était le premier jet ;
 *  - relier deux personnages par une seule forme donne une cape, pas deux mains
 *    qui se tiennent. Il faut deux bras fins et un petit volume à la jonction.
 *
 * Le sujet est celui demandé : une femme et une fille, main dans la main,
 * devant le port. Deux générations dans un métier de commerce international —
 * ce qu'un empilement de conteneurs ne raconte pas.
 *
 * `preserveAspectRatio="xMidYMid slice"` fait qu'elle se comporte comme une
 * photo de fond : elle remplit son cadre et se recadre au centre plutôt que de
 * se déformer. La gauche reste volontairement sombre — c'est là que le titre
 * se pose.
 */
export default function ScenePortAbidjan({ className = '' }: { className?: string }) {
  return (
    <svg
          viewBox="0 0 1600 700"
          preserveAspectRatio="xMidYMid slice"
          role="img"
          aria-label="Le port d'Abidjan au crépuscule : une femme et sa fille regardent un porte-conteneurs à quai."
          className={className}
        >
      <defs>
        <linearGradient id="ciel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#101a2e"/>
          <stop offset="30%"  stopColor="#3a2c46"/>
          <stop offset="55%"  stopColor="#8f4b2a"/>
          <stop offset="76%"  stopColor="#e08b2c"/>
          <stop offset="92%"  stopColor="#f7bd4e"/>
          <stop offset="100%" stopColor="#ffd77a"/>
        </linearGradient>
        <linearGradient id="eau" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#f0a63c"/>
          <stop offset="22%"  stopColor="#b26a2c"/>
          <stop offset="60%"  stopColor="#3d2c33"/>
          <stop offset="100%" stopColor="#141a28"/>
        </linearGradient>
        <radialGradient id="halo" cx="0.63" cy="0.95" r="0.55">
          <stop offset="0%"   stopColor="#ffd98a" stopOpacity="0.75"/>
          <stop offset="55%"  stopColor="#ffbc55" stopOpacity="0.20"/>
          <stop offset="100%" stopColor="#ffbc55" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id="voile" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#0a0e18" stopOpacity="0.55"/>
          <stop offset="38%"  stopColor="#0a0e18" stopOpacity="0.28"/>
          <stop offset="70%"  stopColor="#0a0e18" stopOpacity="0"/>
        </linearGradient>
      </defs>

      {/* ---------- Ciel ---------- */}
      <rect width="1600" height="470" fill="url(#ciel)"/>
      <circle cx="1010" cy="462" r="74" fill="#fff0c0" opacity="0.9"/>
      <rect width="1600" height="470" fill="url(#halo)"/>

      {/* ---------- Grues lointaines ---------- */}
      <g fill="#232c42" opacity="0.75">
        <g transform="translate(150,0)">
          <rect x="0" y="292" width="9" height="178"/><rect x="58" y="292" width="9" height="178"/>
          <rect x="-18" y="282" width="104" height="11"/>
          <rect x="-78" y="244" width="166" height="9"/>
          <rect x="78" y="244" width="96" height="9" transform="rotate(-16 78 248)"/>
          <rect x="28" y="253" width="8" height="34"/>
        </g>
        <g transform="translate(455,0)">
          <rect x="0" y="312" width="8" height="158"/><rect x="50" y="312" width="8" height="158"/>
          <rect x="-15" y="303" width="89" height="10"/>
          <rect x="-66" y="270" width="145" height="8"/>
          <rect x="69" y="270" width="84" height="8" transform="rotate(-16 69 274)"/>
        </g>
        <g transform="translate(1330,0)">
          <rect x="0" y="286" width="10" height="184"/><rect x="66" y="286" width="10" height="184"/>
          <rect x="-20" y="275" width="116" height="12"/>
          <rect x="-88" y="234" width="188" height="10"/>
          <rect x="88" y="234" width="106" height="10" transform="rotate(-16 88 238)"/>
          <rect x="32" y="244" width="9" height="34"/>
        </g>
      </g>

      {/* ---------- Porte-conteneurs ---------- */}
      <g transform="translate(560,286)">
        {/* Pont et coque avec étrave */}
        <rect x="0" y="126" width="620" height="56" rx="4" fill="#1b2438"/>
        <path d="M0 182 L620 182 L648 156 L664 182 L604 208 L34 208 Z" fill="#111827"/>
        <path d="M604 208 L664 182 L672 190 L616 214 Z" fill="#0c111c"/>
        {/* Rangées de conteneurs */}
        <g>
          <g fill="#d08a33"><rect x="34" y="88" width="52" height="34" rx="2"/><rect x="146" y="88" width="52" height="34" rx="2"/><rect x="258" y="88" width="52" height="34" rx="2"/><rect x="426" y="88" width="52" height="34" rx="2"/></g>
          <g fill="#2f3d5c"><rect x="90" y="88" width="52" height="34" rx="2"/><rect x="314" y="88" width="52" height="34" rx="2"/><rect x="482" y="88" width="52" height="34" rx="2"/></g>
          <g fill="#9c6224"><rect x="202" y="88" width="52" height="34" rx="2"/><rect x="370" y="88" width="52" height="34" rx="2"/></g>
          <g fill="#b9782c"><rect x="34" y="54" width="52" height="32" rx="2"/><rect x="202" y="54" width="52" height="32" rx="2"/><rect x="370" y="54" width="52" height="32" rx="2"/></g>
          <g fill="#2a3653"><rect x="146" y="54" width="52" height="32" rx="2"/><rect x="314" y="54" width="52" height="32" rx="2"/></g>
          <g fill="#8a5620"><rect x="90" y="22" width="52" height="30" rx="2"/><rect x="258" y="22" width="52" height="30" rx="2"/></g>
        </g>
        {/* Château arrière */}
        <rect x="524" y="34" width="74" height="90" rx="4" fill="#26304a"/>
        <g fill="#ffe4a8" opacity="0.9">
          <rect x="536" y="48" width="12" height="9"/><rect x="554" y="48" width="12" height="9"/><rect x="572" y="48" width="12" height="9"/>
          <rect x="536" y="66" width="12" height="9"/><rect x="554" y="66" width="12" height="9"/>
        </g>
        <rect x="556" y="10" width="6" height="26" fill="#26304a"/>
      </g>

      {/* ---------- Eau ---------- */}
      <rect y="470" width="1600" height="230" fill="url(#eau)"/>
      <rect y="468" width="1600" height="3" fill="#fff1c4" opacity="0.55"/>
      <g fill="#ffe0a0" opacity="0.45">
        <rect x="946" y="482" width="132" height="6" rx="3"/>
        <rect x="972" y="500" width="84"  height="5" rx="2"/>
        <rect x="932" y="518" width="158" height="5" rx="2"/>
        <rect x="984" y="536" width="62"  height="4" rx="2"/>
        <rect x="944" y="552" width="112" height="4" rx="2"/>
      </g>

      {/* ---------- Piles de conteneurs à quai, à droite ---------- */}
      <g transform="translate(1140,16)">
        <g fill="#243049"><rect x="0" y="446" width="118" height="46" rx="3"/><rect x="126" y="446" width="118" height="46" rx="3"/></g>
        <g fill="#c9812f"><rect x="0" y="494" width="118" height="46" rx="3"/><rect x="252" y="494" width="118" height="46" rx="3"/></g>
        <g fill="#1d2740"><rect x="126" y="494" width="118" height="46" rx="3"/></g>
        <g fill="#8f5a22"><rect x="252" y="446" width="118" height="46" rx="3"/></g>
        <g fill="#101827" opacity="0.35">
          <rect x="0" y="446" width="118" height="4"/><rect x="126" y="446" width="118" height="4"/><rect x="252" y="446" width="118" height="4"/>
        </g>
      </g>

      {/* ---------- Quai ---------- */}
      <rect y="562" width="1600" height="138" fill="#0e1522"/>
      <rect y="556" width="1600" height="8" fill="#1e2a40"/>
      <g fill="#f0a63c" opacity="0.14">
        <rect y="564" width="1600" height="2"/>
      </g>

      {/* ---------- Les deux silhouettes, sur le quai ----------
           Dessinées après le quai : elles se tiennent dessus, pas derrière.
           Proportions à sept têtes — la version précédente en faisait quatre, et
           une silhouette à quatre têtes se lit comme un enfant, ou comme un bloc. */}
      <g fill="#070a11">

        {/* LA FEMME — sommet du crâne 300, pieds 562 : 262 px, tête de 38 px */}
        <g transform="translate(486,0)">
          {/* Chignon et masse de cheveux */}
          <circle cx="4" cy="303" r="13"/>
          <path d="M-20 322 q-2 -25 20 -25 q22 0 20 25 q-1 12 -6 16 l-28 0 q-5 -4 -6 -16 z"/>
          {/* Tête et cou */}
          <ellipse cx="0" cy="320" rx="18" ry="21"/>
          <rect x="-6" y="336" width="12" height="16"/>
          {/* Buste : épaules larges, taille marquée, hanches */}
          <path d="M0 348
                   c-20 0 -33 9 -36 26
                   l-6 34 q-2 12 6 14
                   l-2 30 q-1 12 8 14
                   l60 0 q9 -2 8 -14
                   l-2 -30 q8 -2 6 -14
                   l-6 -34 c-3 -17 -16 -26 -36 -26 z"/>
          {/* Jambes, séparées : c'est le vide entre elles qui fait la silhouette */}
          <path d="M-26 456 l-4 76 q-1 10 7 10 l14 0 q8 0 8 -10 l3 -76 z"/>
          <path d="M26 456 l4 76 q1 10 -7 10 l-14 0 q-8 0 -8 -10 l-3 -76 z"/>
          <rect x="-34" y="550" width="34" height="12" rx="5"/>
          <rect x="2"   y="550" width="34" height="12" rx="5"/>
          {/* Bras gauche, le long du corps, tenant une tablette */}
          <path d="M-34 360 q-13 8 -15 26 l-6 52 q-1 10 7 11 q8 1 10 -9 l7 -50 q2 -12 9 -18 z"/>
          {/* Bras droit, tendu vers la fille */}
          <path d="M30 356 q13 6 16 22 l10 60 q3 12 12 20 l-9 9 q-13 -10 -17 -26 l-11 -60 q-2 -13 -9 -18 z"/>
        </g>

        {/* La tablette */}
        <g transform="translate(486,0)">
          <rect x="-76" y="430" width="44" height="32" rx="4" fill="#101a2c"/>
          <rect x="-72" y="434" width="36" height="24" rx="2" fill="#f0a63c" opacity="0.85"/>
        </g>

        {/* LA FILLE — sommet 400, pieds 562 : 162 px, tête de 24 px */}
        <g transform="translate(600,0)">
          <path d="M-13 414 q-1 -16 13 -16 q14 0 13 16 q-1 8 -4 10 l-18 0 q-3 -2 -4 -10 z"/>
          <ellipse cx="0" cy="414" rx="12" ry="13"/>
          <path d="M-17 410 q-8 -3 -7 -11 q1 -8 9 -8 q6 0 8 6 z"/>
          <path d="M17 410 q8 -3 7 -11 q-1 -8 -9 -8 q-6 0 -8 6 z"/>
          <rect x="-4" y="424" width="8" height="10"/>
          <path d="M0 431
                   c-13 0 -22 6 -24 17
                   l-4 22 q-1 8 4 9
                   l-2 20 q-1 8 5 9
                   l42 0 q6 -1 5 -9
                   l-2 -20 q5 -1 4 -9
                   l-4 -22 c-2 -11 -11 -17 -24 -17 z"/>
          <path d="M-17 500 l-3 48 q-1 7 5 7 l9 0 q5 0 5 -7 l2 -48 z"/>
          <path d="M17 500 l3 48 q1 7 -5 7 l-9 0 q-5 0 -5 -7 l-2 -48 z"/>
          <rect x="-23" y="552" width="24" height="10" rx="4"/>
          <rect x="1"   y="552" width="24" height="10" rx="4"/>
          {/* Bras levé vers la main de la femme */}
          <path d="M-20 438 q-10 4 -13 14 l-8 20 q-4 9 -12 13 l7 8 q11 -6 15 -17 l7 -19 q3 -8 10 -11 z"/>
          <path d="M22 440 q10 5 12 16 l4 30 q1 7 -4 8 q-6 1 -7 -6 l-4 -28 q-1 -8 -7 -12 z"/>
        </g>

        {/* Les mains jointes : un petit volume, pas une passerelle. La version
             précédente reliait les deux corps par une masse qui se lisait comme une
             cape — c'est le genre de détail qui ne se voit qu'en regardant. */}
        <ellipse cx="555" cy="452" rx="14" ry="11"/>
      </g>

      {/* ---------- Voile de lisibilité, à gauche seulement ---------- */}
      <rect fill="url(#voile)"/>
    </svg>
  );
}
