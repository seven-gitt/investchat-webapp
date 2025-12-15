/* eslint-disable */
/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/* eslint-disable */
import React, { type JSX, useContext, useEffect, useRef, useState } from "react";

import AutoHideScrollbar from "./AutoHideScrollbar";
// import { getHomePageUrl } from "../../utils/pages";
import { _t, _tDom } from "../../languageHandler";
import SdkConfig from "../../SdkConfig";
import dis from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import BaseAvatar from "../views/avatars/BaseAvatar";
import { OwnProfileStore } from "../../stores/OwnProfileStore";
import AccessibleButton, { type ButtonEvent } from "../views/elements/AccessibleButton";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import { useEventEmitter } from "../../hooks/useEventEmitter";
import MatrixClientContext, { useMatrixClientContext } from "../../contexts/MatrixClientContext";
import MiniAvatarUploader, { AVATAR_SIZE } from "../views/elements/MiniAvatarUploader";
import PosthogTrackers from "../../PosthogTrackers";
import Modal from "../../Modal";
import { logger } from "matrix-js-sdk/src/logger";
import { ThreepidMedium } from "matrix-js-sdk/src/matrix";
import SettingsStore from "../../settings/SettingsStore";
import { UIFeature } from "../../settings/UIFeature";
import PostRegistrationEmailDialog from "../views/dialogs/PostRegistrationEmailDialog";
// import EmbeddedPage from "./EmbeddedPage";

const onClickSendDm = (ev: ButtonEvent): void => {
    PosthogTrackers.trackInteraction("WebHomeCreateChatButton", ev);
    dis.dispatch({ action: Action.CreateChat });
};

// Explore button hidden

const onClickNewRoom = (ev: ButtonEvent): void => {
    PosthogTrackers.trackInteraction("WebHomeCreateRoomButton", ev);
    dis.dispatch({ action: Action.CreateRoom });
};

interface IProps {
    justRegistered?: boolean;
}

const getOwnProfile = (
    userId: string,
): {
    displayName: string;
    avatarUrl?: string;
} => ({
    displayName: OwnProfileStore.instance.displayName || userId,
    avatarUrl: OwnProfileStore.instance.getHttpAvatarUrl(parseInt(AVATAR_SIZE, 10)) ?? undefined,
});

const UserWelcomeTop: React.FC = () => {
    const cli = useContext(MatrixClientContext);
    const userId = cli.getUserId()!;
    const [ownProfile, setOwnProfile] = useState(getOwnProfile(userId));
    useEventEmitter(OwnProfileStore.instance, UPDATE_EVENT, () => {
        setOwnProfile(getOwnProfile(userId));
    });

    return (
        <div>
            <MiniAvatarUploader
                hasAvatar={!!ownProfile.avatarUrl}
                hasAvatarLabel={_t("onboarding|has_avatar_label")}
                noAvatarLabel={_t("onboarding|no_avatar_label")}
                setAvatarUrl={(url) => cli.setAvatarUrl(url)}
                isUserAvatar
                onClick={(ev) => PosthogTrackers.trackInteraction("WebHomeMiniAvatarUploadButton", ev)}
            >
                <BaseAvatar
                    idName={userId}
                    name={ownProfile.displayName}
                    url={ownProfile.avatarUrl}
                    size={AVATAR_SIZE}
                />
            </MiniAvatarUploader>

            <h1>{_tDom("onboarding|welcome_user", { name: ownProfile.displayName })}</h1>
            <h2>{_tDom("onboarding|welcome_detail")}</h2>
        </div>
    );
};

const HomePage: React.FC<IProps> = ({ justRegistered = false }) => {
    const cli = useMatrixClientContext();
    const config = SdkConfig.get();
    const emailPromptShownRef = useRef(false);

    useEffect(() => {
        if (!justRegistered || emailPromptShownRef.current) return;
        if (!SettingsStore.getValue(UIFeature.ThirdPartyID)) return;

        const userId = cli.getUserId();
        if (!userId) return;

        const dismissalKey = `mx_post_registration_email_prompt_${userId}`;
        if (window.localStorage.getItem(dismissalKey) === "dismissed") {
            return;
        }

        let cancelled = false;

        const checkAndPromptForEmail = async (): Promise<void> => {
            try {
                const threepids = await cli.getThreePids();
                if (cancelled) return;

                const hasEmail = threepids.threepids.some((item) => item.medium === ThreepidMedium.Email);
                if (hasEmail) return;

                emailPromptShownRef.current = true;
                const modal = Modal.createDialog(PostRegistrationEmailDialog, {
                    onFinished: (dismissed?: boolean) => {
                        if (dismissed) {
                            window.localStorage.setItem(dismissalKey, "dismissed");
                        } else {
                            window.localStorage.removeItem(dismissalKey);
                        }
                    },
                });

                modal.finished.then(([dismissed]) => {
                    if (dismissed) {
                        window.localStorage.setItem(dismissalKey, "dismissed");
                    } else {
                        window.localStorage.removeItem(dismissalKey);
                    }
                });
            } catch (error) {
                logger.error("Unable to check post-registration email prompt state", error);
            }
        };

        checkAndPromptForEmail().then();

        return () => {
            cancelled = true;
        };
    }, [cli, justRegistered]);
    // const pageUrl = getHomePageUrl(config, cli);
    // if (pageUrl) {
    //     return <EmbeddedPage className="mx_HomePage" url={pageUrl} scrollbar={true} />;
    // }

    let introSection: JSX.Element;
    if (justRegistered || !OwnProfileStore.instance.getHttpAvatarUrl(parseInt(AVATAR_SIZE, 10))) {
        introSection = <UserWelcomeTop />;
    } else {
        const brandingConfig = SdkConfig.getObject("branding");
        const logoUrl = brandingConfig?.get("auth_header_logo_url") ?? "themes/element/img/logos/element-logo.svg";

        introSection = (
            <React.Fragment>
                <img src={logoUrl} alt={config.brand} />
            </React.Fragment>
        );
    }

    return (
        <AutoHideScrollbar className="mx_HomePage mx_HomePage_default" element="main">
            <div className="mx_HomePage_default_wrapper">
                
                {introSection}
                <div className="mx_HomePage_default_buttons">
                    <AccessibleButton onClick={onClickSendDm} className="mx_HomePage_button_sendDm">
                        {_tDom("onboarding|send_dm")}
                    </AccessibleButton>
                    {/* Explore public rooms hidden */}
                    <AccessibleButton onClick={onClickNewRoom} className="mx_HomePage_button_createGroup">
                        {_tDom("onboarding|create_room")}
                    </AccessibleButton>
                </div>
            </div>
        </AutoHideScrollbar>
    );
};

export default HomePage;
