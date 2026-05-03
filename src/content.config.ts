import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	loader: glob({ pattern: "**/*.mdx", base: "./src/content/blog" }),
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		pubDate: z.date().optional(),
		category: z.string().optional(),
		tags: z.array(z.string()).optional(),
		paperUrl: z.string().optional(),
		codeUrl: z.string().optional(),
		venue: z.string().optional(),
		year: z.union([z.string(), z.number()]).optional(),
	}),
});

export const collections = { blog };
