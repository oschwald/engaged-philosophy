function ensureArray<T>(value: T | T[] | null | undefined): T[] {
	if (Array.isArray(value)) return value;
	return value == null ? [] : [value];
}

function normalizePath(value: string) {
	return value.replace(/\\/g, "/");
}

function globToRegExp(pattern: string) {
	const normalized = normalizePath(pattern)
		.replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
		.replace(/\*\*/g, ".*")
		.replace(/\*/g, "[^/]*");
	return new RegExp(`^${normalized}$`);
}

function toMatcher(pattern: string | RegExp) {
	if (pattern instanceof RegExp) return pattern;
	const regex = globToRegExp(pattern);
	return { test: (value: string) => regex.test(value) };
}

export function createFilter(
	include?: string | RegExp | Array<string | RegExp> | null,
	exclude?: string | RegExp | Array<string | RegExp> | null,
) {
	const includeMatchers = ensureArray(include).map(toMatcher);
	const excludeMatchers = ensureArray(exclude).map(toMatcher);

	return (id: string) => {
		if (typeof id !== "string" || id.includes("\0")) return false;
		const pathId = normalizePath(id);

		for (const matcher of excludeMatchers) {
			if (matcher instanceof RegExp) matcher.lastIndex = 0;
			if (matcher.test(pathId)) return false;
		}

		if (includeMatchers.length === 0) return true;

		for (const matcher of includeMatchers) {
			if (matcher instanceof RegExp) matcher.lastIndex = 0;
			if (matcher.test(pathId)) return true;
		}

		return false;
	};
}
