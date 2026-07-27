const { CompositeDisposable, Emitter } = require("atom");

describe("marker-search-panel", () => {
  let workspaceElement, editor, mainModule, provider, layer, service, consumerDisposable;

  // Minimal stand-in for the layer object a renderer passes to `initialize` and
  // `getItems` (see @lumine-code/marker-host lib/index.js).
  function makeLayer(targetEditor) {
    const fake = {
      editor: targetEditor,
      props: provider,
      cache: new Map(),
      items: [],
      disposables: new CompositeDisposable(),
    };
    fake.update = jasmine.createSpy("update").and.callFake(() => {
      const items = provider.getItems(fake);
      if (items) {
        fake.items = items;
      }
    });
    fake.updateSync = fake.update;
    if (provider.initialize) {
      provider.initialize(fake);
    }
    return fake;
  }

  // Fake provider mirroring the service returned by the bundled
  // search-panel package's provideService().
  function makeFakeService() {
    const emitter = new Emitter();
    return {
      emitter,
      visible: false,
      markerLayers: new Map(),
      resultsMarkerLayerForTextEditor(targetEditor) {
        return this.markerLayers.get(targetEditor) || null;
      },
      isFindVisible() {
        return this.visible;
      },
      onDidUpdate: (callback) => emitter.on("did-update", callback),
      onDidChangeFindVisibility: (callback) => emitter.on("did-change-find-visibility", callback),
    };
  }

  function markResults(...ranges) {
    const markerLayer = editor.addMarkerLayer();
    for (const range of ranges) {
      markerLayer.markScreenRange(range);
    }
    service.markerLayers.set(editor, markerLayer);
    return markerLayer;
  }

  function emitUpdate() {
    service.emitter.emit("did-update");
  }

  beforeEach(async () => {
    workspaceElement = atom.views.getView(atom.workspace);
    jasmine.attachToDOM(workspaceElement);
    const pack = await atom.packages.activatePackage("marker-search-panel");
    mainModule = pack.mainModule;
    provider = mainModule.provideMarkerLayer();
    editor = await atom.workspace.open();
    editor.setText(Array(50).fill("hello world").join("\n"));
    layer = makeLayer(editor);
    service = makeFakeService();
    consumerDisposable = mainModule.consumeSearchControl(service);
  });

  afterEach(() => {
    consumerDisposable.dispose();
    layer.disposables.dispose();
  });

  it("activates and provides a marker layer descriptor", () => {
    expect(atom.packages.isPackageActive("marker-search-panel")).toBe(true);
    expect(provider.name).toBe("search-panel");
    expect(typeof provider.description).toBe("string");
    expect(provider.merge).toBe(true);
    expect(provider.threshold).toBe("marker-search-panel.threshold");
    expect(typeof provider.initialize).toBe("function");
    expect(typeof provider.getItems).toBe("function");
  });

  it("matches the shape of the real search.control service", async () => {
    const activation = atom.packages.activatePackage("search-panel");
    atom.commands.dispatch(workspaceElement, "search-panel:show");
    const searchPanel = await activation;
    const realService = searchPanel.mainModule.provideSearchControl();
    expect(typeof realService.resultsMarkerLayerForTextEditor).toBe("function");
    expect(typeof realService.isFindVisible).toBe("function");
    expect(typeof realService.onDidUpdate).toBe("function");
    expect(typeof realService.onDidChangeFindVisibility).toBe("function");
  });

  it("pushes search result markers of the active editor to the layer", () => {
    markResults(
      [
        [2, 0],
        [2, 5],
      ],
      [
        [10, 0],
        [11, 5],
      ],
    );
    emitUpdate();
    expect(layer.update).toHaveBeenCalled();
    expect(layer.items).toEqual([
      { row: 2, end: 2 },
      { row: 10, end: 11 },
    ]);
  });

  it("forgets the editor once its layer detaches", () => {
    layer.disposables.dispose();
    // Consuming the service in the setup already pushed once; only calls
    // arriving after the detach are the regression.
    layer.update.calls.reset();

    markResults([
      [2, 0],
      [2, 5],
    ]);
    emitUpdate();

    expect(layer.update).not.toHaveBeenCalled();
    expect(mainModule.layers.has(editor)).toBe(false);
  });

  it("returns raw ranges and leaves sorting and merging to the host", () => {
    // Created out of document order on purpose.
    markResults(
      [
        [20, 0],
        [20, 5],
      ],
      [
        [3, 0],
        [3, 5],
      ],
    );
    emitUpdate();
    expect(layer.items).toEqual([
      { row: 20, end: 20 },
      { row: 3, end: 3 },
    ]);
  });

  it("clears the markers when the find panel closes and permanent is disabled", () => {
    atom.config.set("marker-search-panel.permanent", false);
    markResults([
      [2, 0],
      [2, 5],
    ]);

    service.visible = true;
    emitUpdate();
    expect(layer.items).toEqual([{ row: 2, end: 2 }]);

    service.visible = false;
    service.emitter.emit("did-change-find-visibility");
    expect(layer.items).toEqual([]);
  });

  it("clears the markers in editors that are not active", async () => {
    markResults([
      [2, 0],
      [2, 5],
    ]);
    emitUpdate();
    expect(layer.items.length).toBe(1);

    await atom.workspace.open();
    emitUpdate();
    expect(layer.items).toEqual([]);
  });

  it("clears the layers and stops updating once the consumer is disposed", () => {
    markResults([
      [2, 0],
      [2, 5],
    ]);
    emitUpdate();
    expect(layer.items.length).toBe(1);

    consumerDisposable.dispose();
    expect(mainModule.service).toBeNull();
    expect(layer.items).toEqual([]);

    layer.update.calls.reset();
    service.emitter.emit("did-update");
    expect(layer.update).not.toHaveBeenCalled();
  });
});
