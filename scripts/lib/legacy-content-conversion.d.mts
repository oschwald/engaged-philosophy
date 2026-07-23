export interface ConversionChange {
	sourceKind: string;
	collection: string;
	entryId: string;
	revisionId?: string;
	field: string;
	blockPath: string;
	operation: string;
	fromType: string;
	toType: string;
}

export interface ConversionIssue {
	sourceKind: string;
	collection: string;
	entryId: string;
	revisionId?: string;
	field: string;
	blockPath: string;
	type: string;
	blockers?: string[];
	reason?: string;
}

export interface ConversionReport {
	format: string;
	formatVersion: number;
	source: {
		format: string;
		formatVersion: number | null;
		emdashVersion: string | null;
		generatedAt: string | null;
	};
	summary: {
		changedBlocks: number;
		changedFields: number;
		operations: Record<string, number>;
		blockedOccurrences: number;
		deferredOccurrences: number;
	};
	before: {
		trackedOccurrences: number;
		byType: Record<string, unknown>;
	};
	after: {
		trackedOccurrences: number;
		byType: Record<string, unknown>;
	};
	changes: ConversionChange[];
	blocked: ConversionIssue[];
	deferred: ConversionIssue[];
	diagnostics: Array<Record<string, unknown>>;
}

export function convertBackup<T>(backup: T): {
	backup: T;
	report: ConversionReport;
};

export function formatConversionPlan(report: ConversionReport): string;
