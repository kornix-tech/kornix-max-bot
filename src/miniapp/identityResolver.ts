export type ResolvedPolivUser =
  | { status: 'linked'; maxUserId: string; polivUserId: string; displayName: string | null; seasonYear: number }
  | { status: 'not_linked'; maxUserId: string }
  | { status: 'inactive'; maxUserId: string }
  | { status: 'temporarily_unavailable'; maxUserId: string };

export interface MaxIdentityResolver {
  resolve(maxUserId: string): Promise<ResolvedPolivUser>;
}

export class NotLinkedIdentityResolver implements MaxIdentityResolver {
  async resolve(maxUserId: string): Promise<ResolvedPolivUser> {
    return { status: 'not_linked', maxUserId };
  }
}

export class DevelopmentIdentityResolver implements MaxIdentityResolver {
  constructor(private readonly allowedMaxUserId: string, private readonly seasonYear: number) {}

  async resolve(maxUserId: string): Promise<ResolvedPolivUser> {
    return maxUserId === this.allowedMaxUserId
      ? { status: 'linked', maxUserId, polivUserId: 'development-user', displayName: 'Тестовый пользователь', seasonYear: this.seasonYear }
      : { status: 'not_linked', maxUserId };
  }
}
