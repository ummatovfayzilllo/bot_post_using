import { Markup } from 'telegraf';
import { TargetItem } from 'src/common/types';

export class CallbackKeyboardBuilder {
  static startMenu() {
    return Markup.keyboard([
      ['📝 Yangi E\'lon (/new_post)', '📋 E\'lonlar (/posts)'],
      ['📢 Kanallar (/channels)', '👥 Guruhlar (/groups)'],
    ]).resize();
  }

  static aiFormatReviewKeyboard(textToEdit: string = '') {
    const cleanText = textToEdit.replace(/<[^>]*>?/gm, '');

    return Markup.inlineKeyboard([
      [
        Markup.button.callback('✨ AI formatini qabul qilish', 'accept_ai_format'),
      ],
      [
        Markup.button.switchToCurrentChat('✏️ Matnni tahrirlash', cleanText),
      ],
      [
        Markup.button.callback('📝 Asl matnni qoldirish', 'keep_raw_format'),
        Markup.button.callback('❌ Bekor qilish', 'cancel_action'),
      ],
    ]);
  }

  static selectTargetsKeyboard(targets: TargetItem[], selectedIds: string[]) {
    const inlineRows: any[] = [];

    for (const target of targets) {
      const isSelected = selectedIds.includes(target.id);
      const mark = isSelected ? '✅' : '❌';
      const typeIcon = target.type === 'CHANNEL' ? '📢' : '👥';

      inlineRows.push([
        Markup.button.callback(
          `${mark} ${typeIcon} ${target.title}`,
          `toggle_target:${target.id}`,
        ),
      ]);
    }

    // Action buttons
    const controlButtons: any[] = [];
    if (selectedIds.length > 0) {
      controlButtons.push(Markup.button.callback('Davom etish ➡️', 'targets_done'));
    }
    controlButtons.push(Markup.button.callback('❌ Bekor qilish', 'cancel_action'));

    inlineRows.push(controlButtons);

    return Markup.inlineKeyboard(inlineRows);
  }

  static chooseScheduleTypeKeyboard() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('⚡️ Darhol yuborish', 'schedule_instant'),
        Markup.button.callback('⏰ Vaqt belgilash', 'schedule_custom'),
      ],
      [Markup.button.callback('❌ Bekor qilish', 'cancel_action')],
    ]);
  }

  static confirmPostKeyboard() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('🚀 Tasdiqlash va Yuborish', 'confirm_post_send'),
        Markup.button.callback('❌ Bekor qilish', 'cancel_action'),
      ],
    ]);
  }

  static postsListKeyboard(posts: any[], category: 'SCHEDULED' | 'SENT') {
    const inlineRows: any[] = [];

    for (const post of posts) {
      let previewTitle = post.text ? post.text.slice(0, 25) : `[${post.mediaType || 'Media'}]`;
      if (post.text && post.text.length > 25) {
        previewTitle += '...';
      }

      inlineRows.push([
        Markup.button.callback(`📌 ${previewTitle}`, `view_post:${post.id}`),
      ]);
    }

    // Category switch
    inlineRows.push([
      Markup.button.callback(
        category === 'SCHEDULED' ? '➡️ Arxiv postlar' : '➡️ Kutilayotgan postlar',
        category === 'SCHEDULED' ? 'switch_posts:SENT' : 'switch_posts:SCHEDULED',
      ),
    ]);

    return Markup.inlineKeyboard(inlineRows);
  }

  static postDetailKeyboard(postId: string, status: string, text?: string) {
    const rows: any[] = [];
    const cleanText = (text || '').replace(/<[^>]*>/g, '');

    if (status === 'SCHEDULED') {
      rows.push([
        Markup.button.switchToCurrentChat('✏️ Matnni tahrirlash', cleanText),
      ]);
      if (cleanText) {
        rows.push([
          Markup.button.callback('✨ AI bilan qayta formatlash', `ai_reformat:${postId}`),
        ]);
      }
      rows.push([
        Markup.button.callback('⚡️ Darhol yuborish', `send_now:${postId}`),
        Markup.button.callback('🗑 O\'chirish', `delete_post:${postId}`),
      ]);
      rows.push([Markup.button.callback('⬅️ Orqaga', 'back_to_posts:SCHEDULED')]);
    } else {
      if (cleanText) {
        rows.push([
          Markup.button.switchToCurrentChat('✏️ Xabarni tahrirlash', cleanText),
        ]);
        rows.push([
          Markup.button.callback('✨ AI bilan qayta formatlash', `ai_reformat:${postId}`),
        ]);
      }
      rows.push([
        Markup.button.callback('🗑 O\'chirish', `delete_post:${postId}`),
      ]);
      rows.push([Markup.button.callback('⬅️ Orqaga', 'back_to_posts:SENT')]);
    }

    return Markup.inlineKeyboard(rows);
  }

  static channelsMenuKeyboard(channels: any[]) {
    const rows: any[] = [];

    for (const ch of channels) {
      rows.push([
        Markup.button.callback(`📢 ${ch.title}`, `view_channel:${ch.id}`),
        Markup.button.callback('🗑', `delete_channel:${ch.id}`),
      ]);
    }

    rows.push([Markup.button.callback('➕ Yangi kanal qo\'shish', 'add_channel')]);

    return Markup.inlineKeyboard(rows);
  }

  static groupsMenuKeyboard(groups: any[]) {
    const rows: any[] = [];

    for (const gr of groups) {
      rows.push([
        Markup.button.callback(`👥 ${gr.title}`, `view_group:${gr.id}`),
        Markup.button.callback('🗑', `delete_group:${gr.id}`),
      ]);
    }

    rows.push([Markup.button.callback('➕ Yangi guruh qo\'shish', 'add_group')]);

    return Markup.inlineKeyboard(rows);
  }
}
