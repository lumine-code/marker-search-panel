const { CompositeDisposable, Emitter } = require("atom");

describe("scrollmap-search-panel", () => {
  let workspaceElement, editor, mainModule, provider, layer, service, consumerDisposable;

  // Minimal stand-in for the layer object the scrollmap hub passes to
  // `initialize` and `getItems` (see lumine-code/scrollmap lib/layer.js).
  function makeLayer(targetEditor) {
    const fake = {
      editor: targetEditor,
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
    fake.refresh = () => {};
    targetEditor.scrollmap = {
      layers: new Map([[provider.name, fake]]),
      updateView() {},
    };
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
    advanceClock(60); // flush the consumer's 50 ms throttle
  }

  beforeEach(async () => {
    workspaceElement = atom.views.getView(atom.workspace);
    jasmine.attachToDOM(workspaceElement);
    const pack = await atom.packages.activatePackage("scrollmap-search-panel");
    mainModule = pack.mainModule;
    provider = mainModule.provideScrollmap();
    editor = await atom.workspace.open();
    editor.setText(Array(50).fill("hello world").join("\n"));
    layer = makeLayer(editor);
    service = makeFakeService();
    consumerDisposable = mainModule.consumeSearchPanel(service);
  });

  afterEach(() => {
    consumerDisposable.dispose();
    layer.disposables.dispose();
  });

  it("activates and provides a scrollmap layer descriptor", () => {
    expect(atom.packages.isPackageActive("scrollmap-search-panel")).toBe(true);
    expect(provider.name).toBe("find");
    expect(typeof provider.description).toBe("string");
    expect(typeof provider.initialize).toBe("function");
    expect(typeof provider.getItems).toBe("function");
  });

  it("matches the shape of the real search-panel service", async () => {
    const activation = atom.packages.activatePackage("search-panel");
    atom.commands.dispatch(workspaceElement, "search-panel:show");
    const searchPanel = await activation;
    const realService = searchPanel.mainModule.provideService();
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

  it("sorts markers by row and merges adjacent ranges", () => {
    // Created out of document order on purpose.
    markResults(
      [
        [20, 0],
        [20, 5],
      ],
      [
        [4, 0],
        [4, 5],
      ],
      [
        [3, 0],
        [3, 5],
      ],
    );
    emitUpdate();
    expect(layer.items).toEqual([
      { row: 3, end: 4 },
      { row: 20, end: 20 },
    ]);
  });

  it("hides all markers when the item count exceeds the threshold", () => {
    atom.config.set("scrollmap-search-panel.threshold", 1);
    markResults(
      [
        [2, 0],
        [2, 5],
      ],
      [
        [10, 0],
        [10, 5],
      ],
    );
    emitUpdate();
    expect(layer.items).toEqual([]);
  });

  it("clears the markers when the find panel closes and permanent is disabled", () => {
    atom.config.set("scrollmap-search-panel.permanent", false);
    markResults([
      [2, 0],
      [2, 5],
    ]);

    service.visible = true;
    emitUpdate();
    expect(layer.items).toEqual([{ row: 2, end: 2 }]);

    service.visible = false;
    service.emitter.emit("did-change-find-visibility");
    advanceClock(60);
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

  it("stops updating the layer once the consumer is disposed", () => {
    consumerDisposable.dispose();
    expect(mainModule.service).toBeNull();
    layer.update.calls.reset();
    service.emitter.emit("did-update");
    advanceClock(60);
    expect(layer.update).not.toHaveBeenCalled();
  });
});
