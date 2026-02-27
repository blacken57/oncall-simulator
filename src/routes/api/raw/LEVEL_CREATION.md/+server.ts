// @ts-ignore - Importing raw markdown file
import content from '../../../../data/docs/custom/index.md?raw';

export const prerender = true;

export const GET = () => {
  return new Response(content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8'
    }
  });
};
