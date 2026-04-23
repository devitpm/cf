import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

const imageSchema = z.string();

const blog = defineCollection({
	loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
	schema: z.object({
		title: z.string(),
		slug: z.string(),
		mainImage: imageSchema,
		releaseDate: z.coerce.date(),
	}),
});

const products = defineCollection({
	loader: glob({ base: "./src/content/products", pattern: "**/*.md" }),
	schema: z.object({
		name: z.string(),
		slug: z.string(),
		mainImage: imageSchema,
		gallery: z.array(imageSchema),
		price: z.number().nonnegative(),
		discountPrice: z.number().nonnegative().optional(),
		brand: z.string(),
		category: z.string(),
		description: z.string(),
	}),
});

const brands = defineCollection({
	loader: glob({ base: "./src/content/brands", pattern: "**/*.md" }),
	schema: z.object({
		name: z.string(),
		slug: z.string(),
		image: imageSchema,
	}),
});

const categories = defineCollection({
	loader: glob({ base: "./src/content/categories", pattern: "**/*.md" }),
	schema: z.object({
		name: z.string(),
		slug: z.string(),
		image: imageSchema,
	}),
});

const recipes = defineCollection({
	loader: glob({ base: "./src/content/recipes", pattern: "**/*.md" }),
	schema: z.object({
		title: z.string(),
		slug: z.string(),
		mainImage: imageSchema,
		releaseDate: z.coerce.date(),
	}),
});

export const collections = { blog, brands, categories, products, recipes };
