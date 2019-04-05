export interface HttpResponse {
  readonly data: string;
  readonly headers: any;
  readonly statusCode: number | undefined;
}
