export type RepositorySummary = {
  id: number;
  owner: string;
  name: string;
  language: string | null; // Em vez de um tipo ou outro pode ser um optional?
  visibility: 'public' | 'private';
};
