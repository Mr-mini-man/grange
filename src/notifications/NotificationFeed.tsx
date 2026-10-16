import { useEffect, useState } from "react";
import { NOTICE_TTL_MS, useNotificationStore } from "./notificationStore";

const VISIBLE = 5;

/**
 * Bottom-left chat/notification feed. Fades out when no new notice has
 * arrived for `NOTICE_TTL_MS`, then fades back in on the next message.
 */
export function NotificationFeed() {
	const notices = useNotificationStore((s) => s.notices);
	const [idle, setIdle] = useState(true);

	useEffect(() => {
		if (notices.length === 0) return;
		setIdle(false);
		const timer = window.setTimeout(() => setIdle(true), NOTICE_TTL_MS);
		return () => window.clearTimeout(timer);
	}, [notices]);

	const recent = notices.slice(-VISIBLE);

	return (
		<div
			data-testid="notification-feed"
			role="log"
			aria-label="Farm chat and notifications"
			aria-live="polite"
			className={`hud-feed${idle ? " hud-feed-idle" : ""}`}
		>
			<span className="hud-feed-title">Grange Chat</span>
			<ul className="hud-feed-list">
				{recent.map((notice) => (
					<li
						key={notice.id}
						className={`hud-feed-item hud-feed-${notice.kind}`}
					>
						{notice.text}
					</li>
				))}
			</ul>
		</div>
	);
}
