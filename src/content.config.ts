import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';
import { parse } from 'yaml';

const DOMAIN = 'damato.design';

const sites = defineCollection({
  // The file is a plain list of subdomains. getCollection() returns entries
  // sorted by id, so record each one's position as `order` to keep the list order.
  loader: file('src/content/sites.yaml', {
    parser: (text) => (parse(text) as string[]).map((id, order) => ({ id: String(id), order })),
  }),
  schema: z
    .object({
      id: z.string().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Must be a valid subdomain'),
      order: z.number(),
    })
    .transform((data) => ({ ...data, url: `https://${data.id}.${DOMAIN}` })),
});

export const collections = { sites };
