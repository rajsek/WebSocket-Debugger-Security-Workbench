import"./modulepreload-polyfill.js";import{c as o,a as h,j as t,R as d,r as u,P as p}from"./picture-in-picture-2.js";import{o as y,g as c,i as x,a as b}from"./chromeAdapter.js";/* empty css      *//**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=o("Earth",[["path",{d:"M21.54 15H17a2 2 0 0 0-2 2v4.54",key:"1djwo0"}],["path",{d:"M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17",key:"1tzkfa"}],["path",{d:"M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05",key:"14pb5j"}],["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j=o("PanelRightOpen",[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M15 3v18",key:"14nvp0"}],["path",{d:"m10 15-3-3 3-3",key:"1pgupc"}]]);function w(){const[a,n]=u.useState(null);async function i(){try{await y(),window.close()}catch(e){n(r(e))}}async function s(){try{const e=await c();if(e.tabId===null)throw new Error("No active tab is available.");await x(e.tabId),window.close()}catch(e){n(r(e))}}async function l(){try{const e=await c();if(e.tabId===null)throw new Error("No active tab is available.");await b(e.tabId),window.close()}catch(e){n(r(e))}}return t.jsxs("main",{className:"launcher",children:[t.jsx("h1",{children:"WebSocket Workbench"}),t.jsxs("button",{type:"button",onClick:i,children:[t.jsx(j,{size:16})," Side Panel"]}),t.jsxs("button",{type:"button",onClick:s,children:[t.jsx(p,{size:16})," Iframe Overlay"]}),t.jsxs("button",{type:"button",onClick:l,children:[t.jsx(m,{size:16})," Direct Page Overlay"]}),a?t.jsx("p",{className:"error-line",children:a}):null]})}function r(a){return a instanceof Error?`${a.message} Make sure the extension is reloaded from chrome://extensions and Chrome supports Side Panel extensions.`:"Unable to open the selected surface."}h(document.getElementById("root")).render(t.jsx(d.StrictMode,{children:t.jsx(w,{})}));
