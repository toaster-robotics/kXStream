import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PortalPlayer } from '@iptvnator/portal/shared/util';
import { KodiTargetsService } from '@iptvnator/services';
import { ResolvedPortalPlayback } from '@iptvnator/shared/interfaces';
import { KodiCastService } from './kodi-cast.service';

/**
 * Cast-only implementation of the PortalPlayer contract. kXStream never plays
 * video itself: every play/resume/external-play action forwards the resolved
 * stream URL to the Kodi machine selected in the header. Reporting
 * `isEmbeddedPlayer() === false` keeps the detail pages in their browse layout
 * (no inline <video> is ever mounted).
 */
@Injectable({ providedIn: 'root' })
export class KodiCastPlayerService implements PortalPlayer {
    private readonly targets = inject(KodiTargetsService);
    private readonly castService = inject(KodiCastService);
    private readonly snackBar = inject(MatSnackBar);

    isEmbeddedPlayer(): boolean {
        return false;
    }

    async openPlayer(streamUrl: string): Promise<void> {
        await this.castStream(streamUrl);
    }

    async openResolvedPlayback(playback: ResolvedPortalPlayback): Promise<void> {
        await this.castStream(playback.streamUrl);
    }

    async openExternalPlayback(playback: ResolvedPortalPlayback): Promise<void> {
        await this.castStream(playback.streamUrl);
    }

    private async castStream(streamUrl: string): Promise<void> {
        if (!streamUrl) {
            return;
        }
        const target = this.targets.selectedTarget();
        if (!target) {
            this.notify('Add a Kodi machine in Settings → Kodi to cast.');
            return;
        }

        this.notify(`Casting to ${target.name}…`);
        const result = await this.castService.cast(streamUrl, target);
        if (!result.ok) {
            this.notify(`Cast failed: ${result.error ?? 'unknown error'}`);
        }
    }

    private notify(message: string): void {
        this.snackBar.open(message, undefined, { duration: 3000 });
    }
}
