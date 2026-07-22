export type View =
  | 'home'
  | 'fields'
  | 'field'
  | 'irrigation'
  | 'precipitation'
  | 'draft'
  | 'confirm'
  | 'result';

export function backView(view: View): View {
  if (view === 'confirm') return 'draft';
  if (view === 'field') return 'fields';
  if (view === 'irrigation' || view === 'precipitation' || view === 'fields') return 'home';
  if (view === 'draft' || view === 'result') return 'home';
  return 'home';
}
