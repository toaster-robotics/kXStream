import { computed, Injectable, signal } from '@angular/core';
import { v4 as uuid } from 'uuid';
import { DEFAULT_KODI_PORT, KodiTarget } from './kodi.model';

const TARGETS_KEY = 'kxstream.kodi.targets';
const SELECTED_KEY = 'kxstream.kodi.selectedTarget';

export type KodiTargetInput = Omit<KodiTarget, 'id'>;

/**
 * Persists the user's Kodi machines (multiple targets) in localStorage and
 * tracks which one casts by default. Pure client-side state; the backend
 * `/cast` endpoint receives the chosen target's connection details per request.
 */
@Injectable({ providedIn: 'root' })
export class KodiTargetsService {
    private readonly targetsState = signal<KodiTarget[]>(this.loadTargets());
    private readonly selectedIdState = signal<string | null>(
        this.loadSelectedId()
    );

    readonly targets = this.targetsState.asReadonly();
    readonly selectedId = this.selectedIdState.asReadonly();

    readonly selectedTarget = computed<KodiTarget | null>(() => {
        const list = this.targetsState();
        const id = this.selectedIdState();
        return list.find((target) => target.id === id) ?? list[0] ?? null;
    });

    readonly hasTargets = computed(() => this.targetsState().length > 0);

    add(input: KodiTargetInput): KodiTarget {
        const target: KodiTarget = { ...this.normalize(input), id: uuid() };
        const next = [...this.targetsState(), target];
        this.targetsState.set(next);
        this.persistTargets(next);
        if (!this.selectedIdState()) {
            this.select(target.id);
        }
        return target;
    }

    update(id: string, input: KodiTargetInput): void {
        const next = this.targetsState().map((target) =>
            target.id === id ? { ...this.normalize(input), id } : target
        );
        this.targetsState.set(next);
        this.persistTargets(next);
    }

    remove(id: string): void {
        const next = this.targetsState().filter((target) => target.id !== id);
        this.targetsState.set(next);
        this.persistTargets(next);
        if (this.selectedIdState() === id) {
            this.select(next[0]?.id ?? null);
        }
    }

    select(id: string | null): void {
        this.selectedIdState.set(id);
        try {
            if (id) {
                localStorage.setItem(SELECTED_KEY, id);
            } else {
                localStorage.removeItem(SELECTED_KEY);
            }
        } catch {
            // Ignore storage write failures.
        }
    }

    private normalize(input: KodiTargetInput): KodiTargetInput {
        return {
            name: input.name.trim() || input.host.trim(),
            host: input.host.trim(),
            port: input.port || DEFAULT_KODI_PORT,
            username: input.username?.trim() || undefined,
            password: input.password || undefined,
            useHttps: !!input.useHttps,
        };
    }

    private persistTargets(targets: KodiTarget[]): void {
        try {
            localStorage.setItem(TARGETS_KEY, JSON.stringify(targets));
        } catch {
            // Ignore storage write failures.
        }
    }

    private loadTargets(): KodiTarget[] {
        try {
            const raw = localStorage.getItem(TARGETS_KEY);
            const parsed = raw ? (JSON.parse(raw) as KodiTarget[]) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    private loadSelectedId(): string | null {
        try {
            return localStorage.getItem(SELECTED_KEY);
        } catch {
            return null;
        }
    }
}
