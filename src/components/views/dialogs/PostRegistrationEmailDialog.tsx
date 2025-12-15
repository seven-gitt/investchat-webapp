/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useState } from "react";
import { Alert } from "@vector-im/compound-web";
import { logger } from "matrix-js-sdk/src/logger";
import { ThreepidMedium } from "matrix-js-sdk/src/matrix";

import BaseDialog from "./BaseDialog";
import InlineSpinner from "../elements/InlineSpinner";
import DialogButtons from "../elements/DialogButtons";
import { _t } from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import { AddRemoveThreepids } from "../settings/AddRemoveThreepids";
import { type ThirdPartyIdentifier } from "../../../AddThreepid";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";

type LoadingState = "loading" | "loaded" | "error";

interface PostRegistrationEmailDialogProps {
    onFinished?: (dismissed?: boolean) => void;
}

/**
 * Post-registration prompt asking the user to add an email address.
 * Reuses the AddRemoveThreepids UI from Settings to keep behaviour consistent.
 */
const PostRegistrationEmailDialog: React.FC<PostRegistrationEmailDialogProps> = ({ onFinished }) => {
    const client = useMatrixClientContext();
    const [emails, setEmails] = useState<ThirdPartyIdentifier[]>([]);
    const [loadingState, setLoadingState] = useState<LoadingState>("loading");
    const [loadError, setLoadError] = useState(false);
    const [canMake3pidChanges, setCanMake3pidChanges] = useState<boolean>(true);

    const updateThreepids = useCallback(async () => {
        setLoadingState("loading");
        setLoadError(false);
        try {
            const threepids = await client.getThreePids();
            setEmails(threepids.threepids.filter((item) => item.medium === ThreepidMedium.Email));
            setLoadingState("loaded");
        } catch (e) {
            // Don't block the form if fetch fails – let user still add an email.
            logger.error("Unable to load 3pids for post-registration prompt", e);
            setEmails([]);
            setLoadError(true);
            setLoadingState("loaded");
        }
    }, [client]);

    const refreshCapabilities = useCallback(async () => {
        try {
            const capabilities = (await client.getCapabilities()) ?? {};
            const canChange = !capabilities["m.3pid_changes"] || capabilities["m.3pid_changes"].enabled === true;
            setCanMake3pidChanges(canChange);
        } catch {
            setCanMake3pidChanges(true);
        }
    }, [client]);

    useEffect(() => {
        refreshCapabilities().then();
        updateThreepids().then();
    }, [refreshCapabilities, updateThreepids]);

    useEffect(() => {
        if (loadingState === "loaded" && emails.length > 0) {
            onFinished?.(false);
        }
    }, [emails, loadingState, onFinished]);

    const onEmailsChange = useCallback(() => {
        updateThreepids().then();
    }, [updateThreepids]);

    const onEmailAdded = useCallback(() => {
        onFinished?.(false);
    }, [onFinished]);

    const onSkip = useCallback(() => {
        onFinished?.(true);
    }, [onFinished]);

    const renderContent = (): React.ReactNode => {
        if (!SettingsStore.getValue(UIFeature.ThirdPartyID)) {
            return (
                <Alert type="warning" title={_t("settings|general|email_adding_unsupported_by_hs")}>
                    {_t("settings|general|email_adding_unsupported_by_hs")}
                </Alert>
            );
        }

        if (loadingState === "loading") {
            return <InlineSpinner />;
        }

        return (
            <>
                {loadError && (
                    <p className="mx_PostRegistrationEmailDialog_hintError">
                        {_t("settings|general|unable_to_load_emails")}
                    </p>
                )}
                <AddRemoveThreepids
                    mode="hs"
                    medium={ThreepidMedium.Email}
                    threepids={emails}
                    onChange={onEmailsChange}
                    onAddSuccess={onEmailAdded}
                    disabled={!canMake3pidChanges}
                    isLoading={loadingState === "loading"}
                />
            </>
        );
    };

    return (
        <BaseDialog
            className="mx_PostRegistrationEmailDialog"
            contentId="mx_PostRegistrationEmailDialog"
            onFinished={onSkip}
            title={_t("post_registration_email_prompt|title")}
            fixedWidth={false}
        >
            <div className="mx_Dialog_content mx_PostRegistrationEmailDialog_content" id="mx_PostRegistrationEmailDialog">
                <p className="mx_PostRegistrationEmailDialog_subtitle">{_t("post_registration_email_prompt|subtitle")}</p>
                <div className="mx_PostRegistrationEmailDialog_section">
                    <h3 className="mx_PostRegistrationEmailDialog_heading">{_t("settings|general|emails_heading")}</h3>
                    {renderContent()}
                </div>
                <p className="mx_PostRegistrationEmailDialog_hint">
                    {_t("post_registration_email_prompt|hint")}
                </p>
            </div>
            <DialogButtons
                hasCancel={false}
                primaryButton={_t("post_registration_email_prompt|skip")}
                onPrimaryButtonClick={onSkip}
            />
        </BaseDialog>
    );
};

export default PostRegistrationEmailDialog;
