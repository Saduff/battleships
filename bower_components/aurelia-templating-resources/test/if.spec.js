import {If} from '../src/if';
import {BoundViewFactory, ViewSlot, View} from 'aurelia-templating';
import {TaskQueue} from 'aurelia-task-queue';

describe('if', () => {
  let viewSlot, taskQueue, sut, viewFactory;

  beforeEach(() => {
    viewSlot = new ViewSlotMock();
    taskQueue = new TaskQueue();
    viewFactory = new BoundViewFactoryMock();
    sut = new If(viewFactory, viewSlot, taskQueue);
  });

  it('should remove and unbind view when showing and provided value is falsy', () => {
    let view = new ViewMock();
    sut.view = view;
    sut.showing = true;
    spyOn(viewSlot, 'remove');
    spyOn(view, 'unbind');

    sut.valueChanged(false);
    taskQueue.flushMicroTaskQueue();

    expect(viewSlot.remove).toHaveBeenCalledWith(view);
    expect(view.unbind).toHaveBeenCalled();
    expect(sut.showing).toBe(false);
  });

  it('should do nothing when not showing and provided value is falsy', () => {
    let view = new ViewMock();
    sut.view = view;
    sut.showing = false;
    spyOn(viewSlot, 'remove');
    spyOn(view, 'unbind');

    sut.valueChanged(false);
    taskQueue.flushMicroTaskQueue();

    expect(viewSlot.remove).not.toHaveBeenCalled();
    expect(view.unbind).not.toHaveBeenCalled();
    expect(sut.showing).toBe(false);
  });

  it('should do nothing when showing, provided value is falsy and has no view', () => {
    let view = new ViewMock();
    sut.view = null;
    sut.showing = true;
    spyOn(viewSlot, 'remove');
    spyOn(view, 'unbind');

    sut.valueChanged(false);
    taskQueue.flushMicroTaskQueue();

    expect(viewSlot.remove).not.toHaveBeenCalled();
    expect(view.unbind).not.toHaveBeenCalled();
    expect(sut.showing).toBe(false);
  });

  it('should create the view when provided value is truthy and has no view', () => {
    sut.view = null;

    sut.valueChanged(true);

    expect(sut.view).toEqual(jasmine.any(ViewMock));
  });

  it('should create the view with provided binding context', () => {
    sut.value = true;
    sut.view = null;
    spyOn(viewFactory, 'create').and.callFake(() => {
      return new ViewMock();
    });
    let context = 42;

    sut.bind(context);

    expect(viewFactory.create).toHaveBeenCalledWith(context);
  });

  it('should show the view when provided value is truthy and currently not showing', () => {
    sut.showing = false;
    sut.view = new ViewMock();
    spyOn(viewSlot, 'add');

    sut.valueChanged(true);

    expect(sut.showing).toBe(true);
    expect(viewSlot.add).toHaveBeenCalledWith(sut.view);
  });

  it('should bind the view if not bound', () => {
    sut.showing = false;
    let view = new ViewMock();
    sut.view = view;
    spyOn(view, 'bind');

    sut.valueChanged(true);

    expect(view.bind).toHaveBeenCalled();
  });
});

class ViewSlotMock {
  remove() {}
  add () {}
}

class ViewMock {
  bind() {}
  unbind() {}
}

class BoundViewFactoryMock {
  create() {
    return new ViewMock();
  }
}
