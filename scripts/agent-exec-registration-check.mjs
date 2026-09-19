import assert from 'node:assert/strict';

function nativeEntrypoints(source) {
  const start = source.indexOf('const Fl={');
  const endMarker = 'async function jl(){Ll&&(Ll=!1,await Nl())}';
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, 'Native agent-exec activation and cleanup found');
  return source.slice(start, end + endMarker.length);
}

export async function verifyAgentExecRegistration(source) {
  const entrypoints = nativeEntrypoints(source);
  for (const hostEnabled of [false, true]) for (const moveExec of [false, true, 'reject']) for (const localLoop of [false, true]) {
    const state = {}, activations = [], gateCalls = [], registrations = [];
    let runtime, deactivations = 0, providerRegistered = false, localLoopDisposals = 0;
    const context = {extensionPath: '/native/agent-exec', subscriptions: []};
    const hostContext = {extensionPath: '/native/agent-host', subscriptions: []};
    const hostOptions = {registerAgentExecProvider: false, runtimeExtensionPath: context.extensionPath, services: {}, mcpLease: {}, custom: Symbol('preserved')};
    const git = {}, mcp = {}, service = {};
    const cursor = {
      cursorAgentHostEnabled: hostEnabled,
      registerAgentHostRuntime(value) { runtime = value; registrations.push(value); return {dispose() {}}; },
      checkFeatureGate(gate) { gateCalls.push(gate); return gate === 'move' ? moveExec === 'reject' ? Promise.reject(new Error('gate unavailable')) : moveExec : localLoop; }
    };
    const activate = async (receivedContext, options = {}) => {
      activations.push({context: receivedContext, options});
      state.activeGitExecutor = git; state.activeMcpProvider = mcp;
      if (options.registerAgentExecProvider !== false) providerRegistered = true;
    };
    const deactivate = async () => { deactivations++; providerRegistered = false; };
    const localProvider = ({context: receivedContext, runtimeExtensionPath, serviceCtx}) => {
      assert.equal(receivedContext, context); assert.equal(runtimeExtensionPath, context.extensionPath); assert.equal(serviceCtx, service);
      return {disposeProvider() { localLoopDisposals++; }};
    };
    const native = new Function('Al', 'ql', 'Nl', 'G', 'El', 'Il', '$a', 'f', entrypoints + ';return {activate:$l,deactivate:jl};')(
      state, activate, deactivate, {cursor}, 'move', 'loop', localProvider, {q6: () => service});
    await native.activate(context);
    const independentHost = hostEnabled && (moveExec === true || localLoop);
    if (hostEnabled) assert.equal(activations.length, 0, 'Extension does not initialize a second runtime alongside Agent Host');
    if (hostEnabled && !independentHost) {
      await runtime.activate(hostContext, hostOptions);
      assert.equal(activations[0].context, hostContext);
      for (const key of Object.keys(hostOptions).filter(key => key !== 'registerAgentExecProvider')) assert.equal(activations[0].options[key], hostOptions[key]);
      assert.equal(hostOptions.registerAgentExecProvider, false, 'Host options were not mutated');
    } else if (!hostEnabled) {
      assert.equal(activations[0]?.context, context);
    }
    assert.equal(providerRegistered, !independentHost, `Native tool provider ownership: host=${hostEnabled}, move=${moveExec}, loop=${localLoop}`);
    assert.equal(activations.length, Number(!independentHost), 'Only the existing native runtime owner initializes');
    assert.equal(registrations.length, Number(hostEnabled));
    assert.equal(gateCalls.filter(gate => gate === 'move').length, Number(hostEnabled), 'Move-exec gate queried once');
    assert.equal(gateCalls.filter(gate => gate === 'loop').length, Number(hostEnabled));
    if (hostEnabled) {
      assert.equal(runtime.extensionPath, context.extensionPath);
      assert.equal(runtime.getGitExecutor(), independentHost ? undefined : git); assert.equal(runtime.getMcpProvider(), independentHost ? undefined : mcp);
    }
    await native.deactivate();
    assert.equal(deactivations, Number(!hostEnabled), 'Native deactivation follows activation ownership');
    if (hostEnabled && !independentHost) await runtime.deactivate();
    assert.equal(deactivations, Number(!independentHost)); assert.equal(providerRegistered, false);
    await native.deactivate(); assert.equal(deactivations, Number(!independentHost), 'Native cleanup runs once');
    for (const subscription of context.subscriptions) subscription.dispose();
    assert.equal(localLoopDisposals, Number(hostEnabled && moveExec !== true && localLoop), 'Existing local-loop registration is preserved');
  }
}
