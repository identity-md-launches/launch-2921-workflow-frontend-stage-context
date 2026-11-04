var d=Object.create;var u=Object.defineProperty;var p=Object.getOwnPropertyDescriptor;var k=Object.getOwnPropertyNames;var T=Object.getPrototypeOf,_=Object.prototype.hasOwnProperty;var n=(e,r)=>()=>(r||e((r={exports:{}}).exports,r),r.exports);var R=(e,r,t,o)=>{if(r&&typeof r=="object"||typeof r=="function")for(let s of k(r))!_.call(e,s)&&s!==t&&u(e,s,{get:()=>r[s],enumerable:!(o=p(r,s))||o.enumerable});return e};var a=(e,r,t)=>(t=e!=null?d(T(e)):{},R(r||!e||!e.__esModule?u(t,"default",{value:e,enumerable:!0}):t,e));var i=n(l=>{"use strict";var f=Symbol.for("react.transitional.element"),m=Symbol.for("react.fragment");function E(e,r,t){var o=null;if(t!==void 0&&(o=""+t),r.key!==void 0&&(o=""+r.key),"key"in r){t={};for(var s in r)s!=="key"&&(t[s]=r[s])}else t=r;return r=t.ref,{$$typeof:f,type:e,key:o,ref:r!==void 0?r:null,props:t}}l.Fragment=m;l.jsx=E;l.jsxs=E});var j=n((P,x)=>{"use strict";x.exports=i()});var v=a(j()),{jsx:c,jsxs:q,Fragment:C}=v.default;export{C as Fragment,c as jsx,q as jsxs};
/*! Bundled license information:

react/cjs/react-jsx-runtime.production.js:
  (**
   * @license React
   * react-jsx-runtime.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
