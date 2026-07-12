import { Component, inject, input, signal } from '@angular/core';
import {
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { DEFAULT_KODI_PORT, KodiTargetsService } from '@iptvnator/services';

/**
 * Manages the list of Kodi machines kXStream can cast to. Occupies the
 * "playback" settings slot (kXStream never plays video locally).
 */
@Component({
    selector: 'app-settings-kodi-section',
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatIcon,
        MatInputModule,
    ],
    template: `
        <section
            class="settings-group"
            [class.settings-group--active]="activeSection() === 'kodi'"
            id="kodi"
        >
            <header class="settings-group__header">
                <div class="settings-group__header-icon">
                    <mat-icon>cast</mat-icon>
                </div>
                <div class="settings-group__header-text">
                    <h3>Kodi cast targets</h3>
                    <p>
                        Add the Kodi machines to send streams to. When more than
                        one is configured you'll be asked which to cast to.
                    </p>
                </div>
            </header>

            @if (targets.targets().length) {
                <div class="kodi-targets">
                    @for (target of targets.targets(); track target.id) {
                        <div class="kodi-target">
                            <div class="kodi-target__meta">
                                <h4>
                                    {{ target.name }}
                                    @if (
                                        targets.selectedTarget()?.id ===
                                        target.id
                                    ) {
                                        <span class="kodi-target__default"
                                            >default</span
                                        >
                                    }
                                </h4>
                                <p>
                                    {{ target.useHttps ? 'https' : 'http' }}://{{
                                        target.host
                                    }}:{{ target.port }}
                                    {{ target.username ? '· ' + target.username : '' }}
                                </p>
                            </div>
                            <div class="kodi-target__actions">
                                <button
                                    mat-icon-button
                                    title="Set as default"
                                    (click)="targets.select(target.id)"
                                >
                                    <mat-icon>{{
                                        targets.selectedTarget()?.id ===
                                        target.id
                                            ? 'star'
                                            : 'star_border'
                                    }}</mat-icon>
                                </button>
                                <button
                                    mat-icon-button
                                    title="Edit"
                                    (click)="edit(target.id)"
                                >
                                    <mat-icon>edit</mat-icon>
                                </button>
                                <button
                                    mat-icon-button
                                    title="Remove"
                                    (click)="targets.remove(target.id)"
                                >
                                    <mat-icon>delete</mat-icon>
                                </button>
                            </div>
                        </div>
                    }
                </div>
            } @else {
                <p class="kodi-empty">No Kodi machines yet. Add one below.</p>
            }

            <form [formGroup]="form" class="kodi-form" (ngSubmit)="submit()">
                <h4>{{ editingId() ? 'Edit machine' : 'Add a machine' }}</h4>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Name</mat-label>
                    <input matInput formControlName="name" placeholder="Living room" />
                </mat-form-field>
                <div class="kodi-form__row">
                    <mat-form-field
                        appearance="outline"
                        subscriptSizing="dynamic"
                        class="kodi-form__host"
                    >
                        <mat-label>Host / IP</mat-label>
                        <input
                            matInput
                            formControlName="host"
                            placeholder="192.168.50.166"
                        />
                    </mat-form-field>
                    <mat-form-field
                        appearance="outline"
                        subscriptSizing="dynamic"
                        class="kodi-form__port"
                    >
                        <mat-label>Port</mat-label>
                        <input matInput type="number" formControlName="port" />
                    </mat-form-field>
                </div>
                <div class="kodi-form__row">
                    <mat-form-field
                        appearance="outline"
                        subscriptSizing="dynamic"
                    >
                        <mat-label>Username</mat-label>
                        <input matInput formControlName="username" placeholder="kodi" />
                    </mat-form-field>
                    <mat-form-field
                        appearance="outline"
                        subscriptSizing="dynamic"
                    >
                        <mat-label>Password</mat-label>
                        <input matInput type="password" formControlName="password" />
                    </mat-form-field>
                </div>
                <mat-checkbox formControlName="useHttps">Use HTTPS</mat-checkbox>
                <div class="kodi-form__actions">
                    @if (editingId()) {
                        <button mat-button type="button" (click)="cancelEdit()">
                            Cancel
                        </button>
                    }
                    <button
                        mat-flat-button
                        color="primary"
                        type="submit"
                        [disabled]="form.invalid"
                    >
                        {{ editingId() ? 'Save' : 'Add machine' }}
                    </button>
                </div>
            </form>
        </section>
    `,
    styles: [
        `
            .kodi-targets {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-bottom: 16px;
            }
            .kodi-target {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 12px;
                border: 1px solid rgba(128, 128, 128, 0.3);
                border-radius: 8px;
            }
            .kodi-target__meta h4 {
                margin: 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .kodi-target__meta p {
                margin: 2px 0 0;
                opacity: 0.7;
                font-size: 0.85em;
            }
            .kodi-target__default {
                font-size: 0.7em;
                text-transform: uppercase;
                background: rgba(76, 175, 80, 0.2);
                color: #4caf50;
                border-radius: 4px;
                padding: 1px 6px;
            }
            .kodi-empty {
                opacity: 0.7;
                margin-bottom: 16px;
            }
            .kodi-form {
                display: flex;
                flex-direction: column;
                gap: 8px;
                max-width: 560px;
            }
            .kodi-form__row {
                display: flex;
                gap: 12px;
            }
            .kodi-form__row mat-form-field {
                flex: 1;
            }
            .kodi-form__port {
                max-width: 120px;
            }
            .kodi-form__actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                margin-top: 8px;
            }
        `,
    ],
})
export class SettingsKodiSectionComponent {
    readonly activeSection = input<string>();
    readonly targets = inject(KodiTargetsService);

    readonly editingId = signal<string | null>(null);

    readonly form = new FormGroup({
        name: new FormControl('', { nonNullable: true }),
        host: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required],
        }),
        port: new FormControl(DEFAULT_KODI_PORT, { nonNullable: true }),
        username: new FormControl('', { nonNullable: true }),
        password: new FormControl('', { nonNullable: true }),
        useHttps: new FormControl(false, { nonNullable: true }),
    });

    submit(): void {
        if (this.form.invalid) {
            return;
        }
        const value = this.form.getRawValue();
        const input = {
            name: value.name,
            host: value.host,
            port: Number(value.port) || DEFAULT_KODI_PORT,
            username: value.username,
            password: value.password,
            useHttps: value.useHttps,
        };
        const editingId = this.editingId();
        if (editingId) {
            this.targets.update(editingId, input);
        } else {
            this.targets.add(input);
        }
        this.cancelEdit();
    }

    edit(id: string): void {
        const target = this.targets.targets().find((item) => item.id === id);
        if (!target) {
            return;
        }
        this.editingId.set(id);
        this.form.setValue({
            name: target.name,
            host: target.host,
            port: target.port,
            username: target.username ?? '',
            password: target.password ?? '',
            useHttps: !!target.useHttps,
        });
    }

    cancelEdit(): void {
        this.editingId.set(null);
        this.form.reset({ port: DEFAULT_KODI_PORT, useHttps: false });
    }
}
