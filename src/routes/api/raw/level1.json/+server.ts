import level1 from '../../../../data/level1.json';
import { json } from '@sveltejs/kit';

export const prerender = true;

export const GET = () => {
  return json(level1);
};
