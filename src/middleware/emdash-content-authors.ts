import { defineMiddleware } from "astro:middleware";
import { handleContentAuthors } from "emdash";

export const onRequest = defineMiddleware(async (context, next) => {
	const emdash = context.locals.emdash;

	// Temporary compatibility shim for EmDash 0.19.0: the route exists, but
	// the runtime middleware does not attach this handler to Astro locals.
	if (emdash?.db && typeof emdash.handleContentAuthors !== "function") {
		emdash.handleContentAuthors = (collection) =>
			handleContentAuthors(emdash.db, collection);
	}

	return next();
});
