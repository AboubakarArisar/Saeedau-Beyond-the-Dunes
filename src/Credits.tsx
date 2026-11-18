import type {ReactNode} from 'react';
import './credits.css';

function CreditLink({href,children}:{href:string;children:ReactNode}){
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}<span aria-hidden="true"> ↗</span><span className="credits-sr"> (opens in a new tab)</span></a>;
}

export function Credits({back}:{back:()=>void}){
  const license=import.meta.env.BASE_URL+'licenses/';
  return <section className="credits-screen" aria-labelledby="credits-heading">
    <div className="credits-content">
      <button className="credits-back" onClick={back}><span aria-hidden="true">← </span>Back to Menu</button>
      <h1 id="credits-heading">made with <span role="img" aria-label="love">❤️</span> for thar.</h1>
      <p className="credits-byline">Created &amp; Developed by <strong>Abou Bakar Arisar</strong></p>
      <ul className="credits-links" aria-label="Creator links">
        <li><CreditLink href="https://aboubakarisar.tech">Portfolio</CreditLink></li>
        <li><CreditLink href="https://github.com/AboubakarArisar">GitHub</CreditLink></li>
        <li><CreditLink href="https://github.com/AboubakarArisar/Saeedau-Beyond-the-Dunes">Source Code</CreditLink></li>
      </ul>
      <details className="credits-notes">
        <summary>Acknowledgements</summary>
        <ul>
          <li><CreditLink href={license+'manrope.txt'}>Manrope Project Authors</CreditLink> · SIL Open Font License 1.1</li>
          <li><CreditLink href={license+'react.txt'}>React and React DOM</CreditLink> · MIT</li>
          <li><CreditLink href={license+'three.txt'}>Three.js</CreditLink> · MIT</li>
          <li><CreditLink href="https://developers.google.com/youtube/iframe_api_reference">YouTube</CreditLink> · Thar Radio playlist playback. Music belongs to its respective rights holders.</li>
          <li><CreditLink href="https://commons.wikimedia.org/wiki/File:Desert_Hamlets_Tharparkar.jpg">Tharparkar hamlets</CreditLink>, <CreditLink href="https://commons.wikimedia.org/wiki/File:Road_towards_THARPARKAR.jpg">road</CreditLink>, and <CreditLink href="https://commons.wikimedia.org/wiki/Category:Prosopis_cineraria">plant photographs</CreditLink> informed the original models. Reference photos are not bundled.</li>
        </ul>
      </details>
      <p className="credits-closing">from thar, with love.</p>
    </div>
  </section>;
}
