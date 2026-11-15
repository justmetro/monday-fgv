// Substitui @api/api-client.server: chamadas GraphQL com o token de serviço.
import { gql } from './monday';
export default async function getServerApiClient() {
  return { client: { request: <T = any>(query: string, variables: Record<string, unknown> = {}) => gql<T>(query, variables) } };
}
