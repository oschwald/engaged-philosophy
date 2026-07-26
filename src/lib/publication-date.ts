import { tz } from "@date-fns/tz";
import { format } from "date-fns";
import type { SiteSettings } from "emdash";

import {
	SITE_DATE_FORMAT_FALLBACK,
	SITE_TIMEZONE_FALLBACK,
} from "./site-config";

type DateValue = Date | string | number | null | undefined;
type DatePresentationSettings = Partial<
	Pick<SiteSettings, "dateFormat" | "timezone">
>;

function configuredValue(value: string | undefined, fallback: string) {
	const normalized = value?.trim();
	return normalized || fallback;
}

export function formatPublicationDate(
	value: DateValue,
	settings: DatePresentationSettings | null = {},
) {
	if (value === null || value === undefined || value === "") return "";

	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.valueOf())) return "";

	const resolvedSettings = settings ?? {};
	const dateFormat = configuredValue(
		resolvedSettings.dateFormat,
		SITE_DATE_FORMAT_FALLBACK,
	);
	const timezone = configuredValue(
		resolvedSettings.timezone,
		SITE_TIMEZONE_FALLBACK,
	);

	try {
		return format(date, dateFormat, { in: tz(timezone) });
	} catch {
		return format(date, SITE_DATE_FORMAT_FALLBACK, {
			in: tz(SITE_TIMEZONE_FALLBACK),
		});
	}
}
