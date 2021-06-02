import {
  TypeContext, 
  TypeElement,
  TypeElemDesc,
} from '@idraw/types';
import Loader from '../loader';
import { drawBox } from './base';

export function drawSVG<T extends keyof TypeElemDesc>(
  ctx: TypeContext,
  elem: TypeElement<T>,
  loader: Loader,
) {
  const content = loader.getPattern(elem);
  drawBox(ctx, elem, content);
}

 

