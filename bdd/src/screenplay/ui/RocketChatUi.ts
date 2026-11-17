import { By, PageElement, PageElements } from '@serenity-js/web';

const byLabel = (label: string) => `[aria-label="${label}"], [title="${label}"]`;

export const Messages = PageElements.located(By.css('[role="listitem"][aria-roledescription="message"]')).describedAs('messages');
export const LastMessage = Messages.last();

export const ThreadMessageList = PageElement.located(By.css('[role="list"][aria-label="Thread message list"]')).describedAs('thread panel');
export const ThreadComposerInput = PageElement.located(By.css('footer[aria-label="Thread composer"] [name="msg"]')).describedAs('thread composer');
export const RoomComposerInput = PageElement.located(By.css('footer[aria-label="Room composer"] [name="msg"]')).describedAs('room composer');
export const ThreadPreviewOnLastMessage = PageElement.located(By.css('[role="link"][aria-roledescription="thread message preview"]'))
	.of(LastMessage)
	.describedAs('thread preview');

export const ReplyInThreadButton = PageElement.located(By.css(byLabel('Reply in thread'))).of(LastMessage).describedAs('"Reply in thread"');
export const MoreActionsButton = PageElement.located(By.css(byLabel('More'))).of(LastMessage).describedAs('"More" button of the message');

export const menuItem = (name: string) =>
	PageElement.located(By.xpath(`//*[@role="menuitem"][normalize-space(.)="${name}"]`)).describedAs(`menu item "${name}"`);

export const RoomOptionsButton = PageElement.located(By.css('[role="toolbar"][aria-label="Primary room actions"] [aria-label="Options"]')).describedAs(
	'room options',
);

export const CreateNewButton = PageElement.located(By.css(byLabel('Create new'))).describedAs('"Create new"');
export const NewDirectMessageDialog = PageElement.located(By.css('[role="dialog"][aria-label="New direct message"]')).describedAs('direct message dialog');
export const DirectMessageUserInput = PageElement.located(By.css('[role="dialog"] [role="combobox"]')).describedAs('user selector');
export const FirstUserOption = PageElements.located(By.css('[role="option"]')).first().describedAs('first suggested user');
export const CreateDirectMessageButton = PageElement.located(By.xpath('//*[@role="dialog"]//button[normalize-space(.)="Create"]')).describedAs('"Create"');

export const PruneDialog = PageElement.located(By.css('[role="dialog"][aria-label="Prune messages"]')).describedAs('prune panel');
export const NewerThanDate = PageElement.located(By.css('input[aria-label="Newer than Date"]')).describedAs('newer than date');
export const OlderThanDate = PageElement.located(By.css('input[aria-label="Older than Date"]')).describedAs('older than date');
export const DoNotPrunePinnedLabel = PageElement.located(By.xpath('//label[contains(., "Do not prune pinned messages")]')).describedAs(
	'"Do not prune pinned messages"',
);
export const PruneButton = PageElement.located(By.xpath('//*[@role="dialog"]//button[normalize-space(.)="Prune"]')).describedAs('"Prune"');
export const ConfirmPruneButton = PageElement.located(By.xpath('//button[normalize-space(.)="Yes, prune them!"]')).describedAs('"Yes, prune them!"');

export const OpenMenu = PageElement.located(By.css('[role="menu"]')).describedAs('open menu');
