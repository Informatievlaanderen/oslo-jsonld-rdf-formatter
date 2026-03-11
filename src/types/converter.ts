export interface ConvertOptions {
  output?: string;
}

export interface ParseError {
  message: string;
  context?: string;
}

export interface TurtleParseResult {
  nquads: string;
  successCount: number;
  errors: ParseError[];
}
