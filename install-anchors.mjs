import {CLAUDE_PREFIX} from './subscription-prefix.mjs';

export const CURSOR_VERSION = '3.21.12';
export const SUBSCRIPTION_PREFIX = CLAUDE_PREFIX;

export const workbench = {
  [CURSOR_VERSION]: {
    commit: '05ddb9e824590e2c1db6bd2548dd71bf67ac9d20',
    features: {max: true, settings: true, lifecycle: true, actions: true, bubbles: true, model: true},
    desktop: {
      picker: {
        groupReturn: 'return c.mergeLeadingIntoPromotedSection===!0?{leading:[],promoted:[...ie,...ee],others:le}:{leading:ie,promoted:ee,others:le}',
        promotedAnchor: 'HP(smt,{models:B.promoted,title:c?.promotedSectionTitle',
        modelsVar: 'B', jsx: 'HP', fmt: 'smt', renderModel: 'x',
      },
      models: 'c',
      mapper: 'V=>DLt(V)',
      provider: 'async getLocalAgentProviderConfig(e,t){',
      model: 't?.requestedModel?.modelId??e?.modelId',
      local: 'jc',
      run: 'async run(e,t,n,i,r,s,o,a,c,l,u){const h=a6d(u,',
      native: 'Qh(this.storageService,"useDedicatedLocalAgentRuntimeHost")',
      nativeModel: 'g',
      activation: 'function nhp(e){return jc.localMode&&e?.get(Ooy,-1)==="true"}',
      usage: {
        jsx: 'GIy', useState: 'Zur', useEffect: 'eIy', card: 'sb', zs: 'Ts', bar: 'yA', barStyle: 'rdr',
        fn: 'function ZIy(e){const t=Obp(119)',
        children: 'title:"Plan & Usage",children:[ln,qt,un,pn]',
        childrenGpt: 'title:"Plan & Usage",children:[ln,qt,un,pn,GIy(__chatgptUsageSection,{})]',
      },
    },
    glass: {
      picker: {
        groupReturn: 'return l.mergeLeadingIntoPromotedSection===!0?{leading:[],promoted:[...ne,...X],others:ie}:{leading:ne,promoted:X,others:ie}',
        promotedAnchor: 'Y5(e9t,{models:N.promoted,title:l?.promotedSectionTitle',
        modelsVar: 'N', jsx: 'Y5', fmt: 'e9t', renderModel: 'w',
      },
      models: 'l',
      mapper: 'U=>Von(U)',
      provider: 'async getLocalAgentProviderConfig(t,e){',
      model: 'e?.requestedModel?.modelId??t?.modelId',
      local: 'Al',
      run: 'async run(t,e,n,i,r,s,o,a,l,c,u){const d=wum(u,',
      native: 'Pp(this.storageService,"useDedicatedLocalAgentRuntimeHost")',
      nativeModel: 'p',
      activation: 'function lNg(t){return Al.localMode&&t?.get(fNg,-1)==="true"}',
      usage: {
        jsx: 'xik', useState: 'gds', useEffect: 'Eik', card: 'Rf', zs: 'Os', bar: 'Fm', barStyle: 'EEi',
        fn: 'function Rik(t){const e=fBg(119)',
        children: 'title:"Plan & Usage",children:[mt,bt,gt,yt]',
        childrenGpt: 'title:"Plan & Usage",children:[mt,bt,gt,yt,xik(__chatgptUsageSection,{})]',
      },
    },
  },
};

export function workbenchEntry(version = CURSOR_VERSION) {
  const entry = workbench[version];
  if (!entry) throw new Error('Unsupported Cursor version: ' + version);
  return entry;
}
