import { Injectable, signal } from '@angular/core';
import { PortalExternalPlayback } from '@iptvnator/portal/shared/util';
import { ExternalPlayerSession } from '@iptvnator/shared/interfaces';

/**
 * kXStream casts to Kodi rather than managing an external desktop player, so
 * there is never an in-app external session. This no-op satisfies the
 * PortalExternalPlayback contract that the detail pages still consume.
 */
@Injectable({ providedIn: 'root' })
export class NoopExternalPlaybackService implements PortalExternalPlayback {
    readonly activeSession = signal<ExternalPlayerSession | null>(null);
    readonly visibleSession = signal<ExternalPlayerSession | null>(null);

    dismissActiveSession(): void {
        // No external session to dismiss.
    }

    async closeSession(): Promise<void> {
        // No external session to close.
    }
}
