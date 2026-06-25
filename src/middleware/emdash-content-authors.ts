import { defineMiddleware } from "astro:middleware";
import { handleContentAuthors } from "emdash";

export const onRequest = defineMiddleware(async (context, next) => {
	const emdash = context.locals.emdash;

	// The EmDash authors API route expects this handler on Astro locals, but
	// Worker-backed admin tests still see it missing in the route context.
	if (emdash?.db && typeof emdash.handleContentAuthors !== "function") {
		emdash.handleContentAuthors = (collection) =>
			handleContentAuthors(emdash.db, collection);
	}

	return next();
});
