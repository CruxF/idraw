import { 
  TypeScreenPosition, TypeScreenSize, TypeScreenContext, TypePoint, TypePointCursor,
  TypeBoardOptions, TypeBoardSizeOptions, } from '@idraw/types';
import util from '@idraw/util';
import { Watcher } from './lib/watcher';
import { setStyle } from './lib/style';
import Context from './lib/context';
import { TypeBoardEventArgMap } from './lib/event';
import { Scroller } from './lib/scroller';
import { Screen } from './lib/screen';
// import { TempData } from './lib/watcher-temp';
import {
  _canvas, _displayCanvas, _mount, _opts, _hasRendered, _ctx, _displayCtx,
  _originCtx, _watcher, _render, _parsePrivateOptions, _scroller,
  _initEvent, _doScrollX, _doScrollY, _doMoveScroll, _resetContext,
  _screen,
} from './names';

const { throttle } = util.time;

type PrivateOptions = TypeBoardOptions & {
  devicePixelRatio: number
}

class Board {
  private [_canvas]: HTMLCanvasElement;
  private [_displayCanvas]: HTMLCanvasElement;
  private [_mount]: HTMLDivElement;
  private [_opts]: PrivateOptions;
  private [_hasRendered] = false;
  private [_ctx]: Context;
  private [_displayCtx]: CanvasRenderingContext2D;
  private [_originCtx]: CanvasRenderingContext2D;
  private [_watcher]: Watcher;
  private [_scroller]: Scroller;
  private [_screen]: Screen;

  constructor(mount: HTMLDivElement, opts: TypeBoardOptions) {
    this[_mount] = mount;
    this[_canvas] = document.createElement('canvas');
    this[_displayCanvas] = document.createElement('canvas');
    this[_mount].appendChild(this[_displayCanvas]);
    this[_opts] = this[_parsePrivateOptions](opts);
    this[_originCtx] = this[_canvas].getContext('2d') as CanvasRenderingContext2D;
    this[_displayCtx] = this[_displayCanvas].getContext('2d') as CanvasRenderingContext2D;
    this[_ctx] = new Context(this[_originCtx], this[_opts]);
    this[_screen] = new Screen(this[_ctx], this[_opts]);
    this[_watcher] = new Watcher(this[_displayCanvas]);
    this[_scroller] = new Scroller(
      this[_displayCtx], {
        width: opts.width,
        height: opts.height,
        devicePixelRatio: opts.devicePixelRatio || 1,
        scrollConfig: opts.scrollConfig,
      });
    this[_render]();
  }

  getDisplayContext(): CanvasRenderingContext2D {
    return this[_displayCtx];
  }

  getOriginContext(): CanvasRenderingContext2D {
    return this[_originCtx];
  }

  getContext(): Context {
    return this[_ctx];
  }

  scale(scaleRatio: number): TypeScreenContext {
    if (scaleRatio > 0) {
      this[_ctx].setTransform({ scale: scaleRatio });
    }
    const { position, size } = this[_screen].calcScreen();
    return { position, size};
  }

  scrollX(x: number) {
    if (x >= 0 || x < 0) {
      this[_ctx].setTransform({ scrollX: x });
    }
    const { position, size } = this[_screen].calcScreen();
    return { position, size};
  }

  scrollY(y: number): TypeScreenContext {
    if (y >= 0 || y < 0) {
      this[_ctx].setTransform({ scrollY: y });
    }
    const { position, size } = this[_screen].calcScreen();
    return { position, size};
  }

  getTransform() {
    return this[_ctx].getTransform();
  }

  draw(): TypeScreenContext {
    this.clear();
    const { position, deviceSize, size } = this[_screen].calcScreen();
    this[_displayCtx].drawImage(
      this[_canvas], deviceSize.x, deviceSize.y, deviceSize.w, deviceSize.h
    );
    if (this[_opts].canScroll === true) {
      this[_scroller].draw(position);
    }
    return { position, size };
  }

  clear() {
    this[_displayCtx].clearRect(0, 0, this[_displayCanvas].width, this[_displayCanvas].height);
  }

  on<T extends keyof TypeBoardEventArgMap >(name: T, callback: (p: TypeBoardEventArgMap[T]) => void) {
    this[_watcher].on(name, callback);
  }

  off<T extends keyof TypeBoardEventArgMap >(name: T, callback: (p: TypeBoardEventArgMap[T]) => void) {
    this[_watcher].off(name, callback);
  }

  getScreenInfo(): {
    size: TypeScreenSize, position: TypeScreenPosition, deviceSize: TypeScreenSize,
    width: number, height: number, devicePixelRatio: number
    } {
    return this[_screen].calcScreen();
  }

  setCursor(cursor: TypePointCursor) {
    this[_displayCanvas].style.cursor = cursor;
  }

  resetCursor() {
    this[_displayCanvas].style.cursor = 'auto';
  }

  resetSize(opts: TypeBoardSizeOptions) {
    this[_opts] = { ...this[_opts], ...opts };
    this[_resetContext]();
    this[_ctx].resetSize(opts);
    this[_screen].resetSize(opts);
    this[_scroller].resetSize({
      width: this[_opts].width,
      height: this[_opts].height,
      devicePixelRatio: this[_opts].devicePixelRatio
    });
    this.draw();
  }

  getScrollLineWidth(): number {
    let lineWidth = 0;
    if (this[_opts].canScroll === true) {
      lineWidth = this[_scroller].getLineWidth();
    }
    return lineWidth;
  }

  pointScreenToContext(screenPoint: TypePoint): TypePoint {
    const { scrollX, scrollY, scale } = this.getTransform();
    const ctxPoint = {
      x: (screenPoint.x - scrollX) / scale,
      y: (screenPoint.y - scrollY) / scale,
    };
    return ctxPoint;
  }

  pointContextToScreen(ctxPoint: TypePoint): TypePoint {
    const { scrollX, scrollY, scale } = this.getTransform();
    const screenPoint = {
      x: ctxPoint.x * scale + scrollX,
      y: ctxPoint.y * scale + scrollY,
    };
    return screenPoint;
  }

  private [_render]() {
    if (this[_hasRendered] === true) {
      return;
    }
    this[_resetContext]();
    this[_initEvent]();
    this[_hasRendered] = true;
  }

  private [_resetContext] () {
    const { width, height, contextWidth, contextHeight, devicePixelRatio } = this[_opts];
    this[_canvas].width = contextWidth * devicePixelRatio;
    this[_canvas].height = contextHeight * devicePixelRatio;

    this[_displayCanvas].width = width * devicePixelRatio;
    this[_displayCanvas].height = height * devicePixelRatio;

    setStyle(this[_displayCanvas], {
      width: `${width}px`,
      height: `${height}px`,
    });
  }
  
  private [_parsePrivateOptions](opts: TypeBoardOptions): PrivateOptions {
    const defaultOpts = {
      devicePixelRatio: 1,
    };
    return { ...defaultOpts, ...opts };
  }

  private [_initEvent]() {
    if (this[_hasRendered] === true) {
      return;
    }
    if (this[_opts].canScroll === true) {

      this.on('wheelX', throttle((deltaX) => {
        this[_doScrollX](deltaX);
      }, 16));
      this.on('wheelY', throttle((deltaY: number) => {
        this[_doScrollY](deltaY);
      }, 16));

      let scrollType: 'x' | 'y' | null = null;
      this.on('moveStart', throttle((p: TypePoint) => {
        if (this[_scroller].isPointAtScrollX(p)) {
          scrollType = 'x';
        } else if (this[_scroller].isPointAtScrollY(p)) {
          scrollType = 'y';
        }
      }, 16));

      this.on('move', throttle((p: TypePoint) => {
        if (scrollType) {
          this[_doMoveScroll](scrollType, p);
        }
      }, 16));

      this.on('moveEnd', throttle((p: TypePoint) => {
        if (scrollType) {
          this[_doMoveScroll](scrollType, p);
        }
        scrollType = null;
      }, 16));

      // this.on('doubleClick', (p: TypePoint) => {})
    }
  }

  private [_doScrollX](dx: number, prevScrollX?: number) {
    const { width } = this[_opts];
    let scrollX = prevScrollX;
    if (!(typeof scrollX === 'number' && (scrollX > 0 || scrollX <= 0))) {
      scrollX = this[_ctx].getTransform().scrollX;
    }
    const { position } = this[_screen].calcScreen();
    const { xSize } = this[_scroller].calc(position);
    const moveX = this[_screen].calcScreenScroll(position.left, position.right, xSize, width, dx);
    this.scrollX(scrollX + moveX);
    this.draw();
  }

  private [_doScrollY](dy: number, prevScrollY?: number) {
    const { height } = this[_opts];
    let scrollY = prevScrollY;
    if (!(typeof scrollY === 'number' && (scrollY > 0 || scrollY <= 0))) {
      scrollY = this[_ctx].getTransform().scrollY;
    }
    const { position } = this[_screen].calcScreen();
    const { ySize } = this[_scroller].calc(position);
    const moveY = this[_screen].calcScreenScroll(position.top, position.bottom, ySize, height, dy);
    this.scrollY(scrollY + moveY);
    this.draw();
  }

  private [_doMoveScroll](scrollType: 'x' | 'y', point: TypePoint) {
    if (!scrollType) {
      return;
    }
    const { position } = this[_screen].calcScreen();
    const { xSize, ySize } = this[_scroller].calc(position);
    if (scrollType === 'x') {
      this[_doScrollX](point.x - xSize / 2, 0);
    } else if (scrollType === 'y') {
      this[_doScrollY](point.y - ySize / 2, 0);
    }
  }


}

export default Board;

