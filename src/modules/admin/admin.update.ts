import { UseGuards, Logger } from '@nestjs/common';
import { Update, Ctx, Start, Command, Hears, On, Action } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { UserFilterGuard } from 'src/global/user_filter/user_filter.guard';
import { StateService } from 'src/core/state.service';
import { ChannelsService } from 'src/modules/channels/channels.service';
import { GroupsService } from 'src/modules/groups/groups.service';
import { PostsService } from 'src/modules/posts/posts.service';
import { PostFormatterService } from 'src/core/post_formatter.service';
import { VoiceTranscriberService } from 'src/core/voice_transcriber.service';
import { UsersService } from 'src/modules/users/users.service';
import { AdminService } from './admin.service';
import { MessageGenerator } from 'src/common/utils/_message_generator';
import { CallbackKeyboardBuilder } from 'src/common/utils/_cb_functions';
import { SmartDateParser } from 'src/common/utils/date_parser';
import { BotWizardStep } from 'src/common/types';

@Update()
@UseGuards(UserFilterGuard)
export class AdminUpdate {
  private readonly logger = new Logger(AdminUpdate.name);

  constructor(
    private readonly stateService: StateService,
    private readonly channelsService: ChannelsService,
    private readonly groupsService: GroupsService,
    private readonly postsService: PostsService,
    private readonly postFormatter: PostFormatterService,
    private readonly voiceTranscriber: VoiceTranscriberService,
    private readonly usersService: UsersService,
    private readonly adminService: AdminService,
  ) {}

  private async safeReply(ctx: Context, text: string, extra: any = {}) {
    try {
      return await ctx.reply(text, { parse_mode: 'HTML', ...extra });
    } catch (err) {
      this.logger.warn(`HTML parse failed (${err.message}), falling back to plain text.`);
      const fallbackExtra = { ...extra };
      delete fallbackExtra.parse_mode;
      return await ctx.reply(text.replace(/<[^>]*>?/gm, ''), fallbackExtra);
    }
  }

  private async safeEditMessageText(ctx: Context, text: string, extra: any = {}) {
    try {
      return await ctx.editMessageText(text, { parse_mode: 'HTML', ...extra });
    } catch (err) {
      this.logger.warn(`HTML editMessageText failed (${err.message}), falling back to plain text.`);
      const fallbackExtra = { ...extra };
      delete fallbackExtra.parse_mode;
      return await ctx.editMessageText(text.replace(/<[^>]*>?/gm, ''), fallbackExtra);
    }
  }

  private formatReviewMessage(beautified: string): string {
    return (
      `✨ <b>Formatlangan post ko'rinishi:</b>\n\n${beautified}\n\n` +
      `<i>Quyidagi variantlardan birini tanlang:</i>`
    );
  }

  @On('my_chat_member')
  async onMyChatMember(@Ctx() ctx: Context) {
    try {
      const update = ctx.update as any;
      const chatMember = update.my_chat_member;
      if (!chatMember) return;

      const newStatus = chatMember.new_chat_member?.status;
      const fromUser = chatMember.from;
      const chat = chatMember.chat;

      // Agar bot yangi qo'shilgan yoki admin qilingan bo'lsa
      if (['administrator', 'member'].includes(newStatus)) {
        const isAllowed = await this.usersService.isUserAllowed(BigInt(fromUser.id));

        if (!isAllowed) {
          this.logger.warn(
            `Ruxsatsiz shaxs (${fromUser.id} / @${fromUser.username}) botni chatga (${chat.id} / "${chat.title}") qo'shishga urindi. Bot chatdan chiqib ketmoqda...`,
          );

          try {
            await ctx.reply(
              '⚠️ <b>Ruxsatsiz ulanish!</b>\n\nUshbu bot faqat ruxsat etilgan ma\'murlar tomonidan boshqariladi. Bot chatni tark etmoqda.',
              { parse_mode: 'HTML' },
            );
          } catch (e) {}

          await ctx.telegram.leaveChat(chat.id);
        } else {
          this.logger.log(
            `Ruxsat berilgan admin (${fromUser.id}) botni chatga (${chat.id} / "${chat.title}") muvaffaqiyatli uladi.`,
          );

          // Guruh yoki kanalni avtomatik tarzda bazaga qo'shamiz va adminga xabar beramiz
          try {
            if (chat.type === 'channel') {
              const res = await this.channelsService.addChannel(chat.id.toString());
              if (res.success) {
                await ctx.telegram.sendMessage(
                  fromUser.id,
                  `✅ <b>Kanal avtomatik ulandi!</b>\n\n📢 <b>Nomi:</b> ${chat.title || 'Kanal'}\n🆔 <b>Chat ID:</b> <code>${chat.id}</code>\n\n<i>Endi /new_post orqali ushbu kanalga xabarlar yuborishingiz mumkin.</i>`,
                  { parse_mode: 'HTML' },
                );
              }
            } else if (chat.type === 'group' || chat.type === 'supergroup') {
              const res = await this.groupsService.addGroup(chat.id.toString());
              if (res.success) {
                await ctx.telegram.sendMessage(
                  fromUser.id,
                  `✅ <b>Guruh avtomatik ulandi!</b>\n\n👥 <b>Nomi:</b> ${chat.title || 'Guruh'}\n🆔 <b>Chat ID:</b> <code>${chat.id}</code>\n\n<i>Endi /new_post orqali ushbu guruhga xabarlar yuborishingiz mumkin.</i>`,
                  { parse_mode: 'HTML' },
                );
              }
            }
          } catch (autoErr) {
            this.logger.warn(`Avtomatik ulashda ogohlantirish: ${autoErr.message}`);
          }
        }
      }
    } catch (error) {
      this.logger.error('onMyChatMember da xatolik:', error);
    }
  }

  @Start()
  async onStart(@Ctx() ctx: Context) {
    try {
      if (!ctx.from) return;
      const userId = BigInt(ctx.from.id);

      await this.adminService.ensureUserExists(
        userId,
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username,
      );

      await this.stateService.clearState(userId);

      const name = ctx.from.first_name || 'Admin';
      await this.safeReply(ctx, MessageGenerator.welcomeMessage(name), CallbackKeyboardBuilder.startMenu());
    } catch (error) {
      this.logger.error('onStart da xatolik:', error);
      await ctx.reply('Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
    }
  }

  @Command('cancel')
  @Hears('❌ Bekor qilish')
  async onCancel(@Ctx() ctx: Context) {
    try {
      if (!ctx.from) return;
      const userId = BigInt(ctx.from.id);
      await this.stateService.clearState(userId);
      await ctx.reply('Amal bekor qilindi.', CallbackKeyboardBuilder.startMenu());
    } catch (error) {
      this.logger.error('onCancel da xatolik:', error);
    }
  }

  @Command('new_post')
  @Hears('📝 Yangi E\'lon (/new_post)')
  async onNewPost(@Ctx() ctx: Context) {
    try {
      if (!ctx.from) return;
      const userId = BigInt(ctx.from.id);

      await this.stateService.setState({
        userId,
        step: BotWizardStep.WAITING_FOR_CONTENT,
        draftPost: {
          selectedTargets: [],
        },
      });

      await this.safeReply(ctx, MessageGenerator.askPostContent());
    } catch (error) {
      this.logger.error('onNewPost da xatolik:', error);
      await ctx.reply('Yangi post jarayonini boshlashda xatolik yuz berdi.');
    }
  }

  @Command('channels')
  @Hears('📢 Kanallar (/channels)')
  async onChannels(@Ctx() ctx: Context) {
    try {
      const channels = await this.channelsService.listChannels();
      let text = '📢 <b>Ulangan Kanallar ro\'yxati:</b>\n\n';

      if (channels.length === 0) {
        text += '<i>Hozircha kanallar qo\'shilmagan.</i>';
      } else {
        channels.forEach((ch, idx) => {
          const handle = ch.username ? `@${ch.username}` : ch.title;
          const status = ch.hasAdmin && ch.canPost ? '✅ Admin' : '❌ Huquq yetarsiz';
          text += `${idx + 1}. <b>${ch.title}</b> (${handle}) — ${status}\n`;
        });
      }

      await this.safeReply(ctx, text, CallbackKeyboardBuilder.channelsMenuKeyboard(channels));
    } catch (error) {
      this.logger.error('onChannels da xatolik:', error);
      await ctx.reply('Kanallarni yuklashda xatolik yuz berdi.');
    }
  }

  @Command('groups')
  @Hears('👥 Guruhlar (/groups)')
  async onGroups(@Ctx() ctx: Context) {
    try {
      const groups = await this.groupsService.listGroups();
      let text = '👥 <b>Ulangan Guruhlar ro\'yxati:</b>\n\n';

      if (groups.length === 0) {
        text += '<i>Hozircha guruhlar qo\'shilmagan.</i>';
      } else {
        groups.forEach((gr, idx) => {
          const handle = gr.username ? `@${gr.username}` : gr.title;
          const status = gr.canPost ? '✅ Xabar yoza oladi' : '❌ Huquq yetarsiz';
          text += `${idx + 1}. <b>${gr.title}</b> (${handle}) — ${status}\n`;
        });
      }

      await this.safeReply(ctx, text, CallbackKeyboardBuilder.groupsMenuKeyboard(groups));
    } catch (error) {
      this.logger.error('onGroups da xatolik:', error);
      await ctx.reply('Guruhlarni yuklashda xatolik yuz berdi.');
    }
  }

  @Command('posts')
  @Hears('📋 E\'lonlar (/posts)')
  async onPosts(@Ctx() ctx: Context) {
    try {
      const posts = await this.postsService.listPosts('SCHEDULED');
      let text = '⏰ <b>Kutilayotgan (Rejalashtirilgan) E\'lonlar:</b>\n\n';

      if (posts.length === 0) {
        text += '<i>Kutilayotgan e\'lonlar mavjud emas.</i>';
      }

      await this.safeReply(ctx, text, CallbackKeyboardBuilder.postsListKeyboard(posts, 'SCHEDULED'));
    } catch (error) {
      this.logger.error('onPosts da xatolik:', error);
      await ctx.reply('Postlarni yuklashda xatolik yuz berdi.');
    }
  }

  @On('text')
  async onText(@Ctx() ctx: Context) {
    try {
      if (!ctx.from || !ctx.message || !('text' in ctx.message)) return;
      const userId = BigInt(ctx.from.id);
      const text = ctx.message.text.trim();

      if (text.startsWith('/') || text.includes('(/')) {
        return;
      }

      const state = await this.stateService.getState(userId);

      switch (state.step) {
        case BotWizardStep.WAITING_FOR_CONTENT: {
          const processingMsg = await ctx.reply('⏳ <i>Post matni AI yordamida chiroyli qilinmoqda...</i>', {
            parse_mode: 'HTML',
          });

          const beautified = await this.postFormatter.beautifyPost(text);

          state.draftPost = {
            ...state.draftPost,
            rawText: text,
            beautifiedText: beautified,
            text: beautified,
          };
          state.step = BotWizardStep.REVIEWING_AI_FORMAT;
          await this.stateService.setState(state);

          try {
            await ctx.deleteMessage(processingMsg.message_id);
          } catch (e) {}

          await this.safeReply(
            ctx,
            this.formatReviewMessage(beautified),
            CallbackKeyboardBuilder.aiFormatReviewKeyboard(beautified),
          );
          break;
        }

        case BotWizardStep.REVIEWING_AI_FORMAT: {
          // Foydalanuvchi tahrirlangan matnni yubordi
          let editedText = text;
          editedText = editedText.replace(/^@\w+\s*/, '').trim();

          state.draftPost = {
            ...state.draftPost,
            text: editedText,
          };
          state.step = BotWizardStep.SELECTING_TARGETS;
          await this.stateService.setState(state);

          const targets = await this.adminService.getAllTargets();
          await this.safeReply(
            ctx,
            `✏️ <b>Tahrirlangan matn qabul qilindi!</b>\n\n` +
              MessageGenerator.selectTargetsMessage(targets, state.draftPost.selectedTargets || []),
            CallbackKeyboardBuilder.selectTargetsKeyboard(targets, state.draftPost.selectedTargets || []),
          );
          break;
        }

        case BotWizardStep.EDITING_EXISTING_POST: {
          if (!state.editingPostId) {
            await ctx.reply('⚠️ Tahrirlanayotgan post topilmadi.');
            await this.stateService.clearState(userId);
            break;
          }

          let editedText = text;
          editedText = editedText.replace(/^@\w+\s*/, '').trim();

          const updateResult = await this.postsService.updatePostText(state.editingPostId, editedText);
          if (updateResult.success) {
            let msgHeader = '✅ <b>Post matni muvaffaqiyatli yangilandi!</b>';
            if (updateResult.isSent) {
              msgHeader = `✅ <b>Yuborilgan xabar Telegramda jonli tahrirlandi!</b> (${updateResult.editSuccessCount} ta chat)`;
              if (updateResult.editFailCount && updateResult.editFailCount > 0) {
                msgHeader += ` (Xatolik: ${updateResult.editFailCount} ta)`;
              }
            }

            const updatedPost = await this.postsService.getPostDetail(state.editingPostId);
            if (updatedPost) {
              const previewText = MessageGenerator.postPreviewMessage({
                text: updatedPost.text,
                mediaType: updatedPost.mediaType,
                scheduledAt: updatedPost.scheduledAt,
                status: updatedPost.status,
                targetsCount: updatedPost.targets.length,
                createdAt: updatedPost.createdAt,
              });

              await this.safeReply(
                ctx,
                `${msgHeader}\n\n${previewText}`,
                CallbackKeyboardBuilder.postDetailKeyboard(updatedPost.id, updatedPost.status, updatedPost.text || undefined),
              );
            }
          } else {
            await ctx.reply(`❌ Postni yangilashda xatolik: ${updateResult.message}`);
          }
          break;
        }

        case BotWizardStep.WAITING_FOR_DATE: {
          const parsedDate = SmartDateParser.parseDate(text);
          if (!parsedDate) {
            const nowTime = SmartDateParser.getTashkentNowFormatted();
            await ctx.reply(
              `⚠️ <b>Noto'g'ri vaqt formati yoki o'tgan vaqt kiritildi!</b>\n\n` +
              `🕒 <b>Hozirgi vaqt:</b> <code>${nowTime}</code>\n\n` +
              `📌 <b>Qulay misollar:</b>\n` +
              `▫️ <code>14:30</code> (bugun)\n` +
              `▫️ <code>+5m</code> yoki <code>10m</code> (daqiqa)\n` +
              `▫️ <code>2026-09-06 18:00</code> (to'liq sana)`,
              { parse_mode: 'HTML' },
            );
            return;
          }

          state.draftPost = {
            ...state.draftPost,
            scheduledAt: parsedDate,
          };
          state.step = BotWizardStep.CONFIRMING;
          await this.stateService.setState(state);

          const previewText = MessageGenerator.postPreviewMessage({
            text: state.draftPost.text,
            mediaType: state.draftPost.mediaType,
            scheduledAt: parsedDate,
            status: 'SCHEDULED',
            targetsCount: (state.draftPost.selectedTargets || []).length,
            createdAt: new Date(),
          });

          await this.safeReply(ctx, previewText, CallbackKeyboardBuilder.confirmPostKeyboard());
          break;
        }

        case BotWizardStep.ADDING_CHANNEL: {
          const res = await this.channelsService.addChannel(text);
          if (res.success) {
            await this.safeReply(
              ctx,
              MessageGenerator.channelHealthCheckSuccess(res.title, res.username),
              CallbackKeyboardBuilder.startMenu(),
            );
          } else {
            await this.safeReply(
              ctx,
              MessageGenerator.channelHealthCheckFailed(text, res.message || 'Noma\'lum xatolik'),
              CallbackKeyboardBuilder.startMenu(),
            );
          }
          await this.stateService.clearState(userId);
          break;
        }

        case BotWizardStep.ADDING_GROUP: {
          const res = await this.groupsService.addGroup(text);
          if (res.success) {
            await this.safeReply(
              ctx,
              `✅ <b>Guruh muvaffaqiyatli qo'shildi!</b>\n\n📌 <b>Nomi:</b> ${res.title}`,
              CallbackKeyboardBuilder.startMenu(),
            );
          } else {
            await this.safeReply(
              ctx,
              `❌ <b>Guruhni qo'shishda xatolik:</b>\n${res.message}`,
              CallbackKeyboardBuilder.startMenu(),
            );
          }
          await this.stateService.clearState(userId);
          break;
        }

        default: {
          const processingMsg = await ctx.reply('⏳ <i>Xabaringiz AI tomonidan tahlil qilinmoqda...</i>', {
            parse_mode: 'HTML',
          });

          const analysis = await this.postFormatter.analyzeAndProcess(text);

          try {
            await ctx.deleteMessage(processingMsg.message_id);
          } catch (e) {}

          if (analysis.type === 'POST') {
            state.draftPost = {
              ...state.draftPost,
              rawText: text,
              beautifiedText: analysis.content,
              text: analysis.content,
            };
            state.step = BotWizardStep.REVIEWING_AI_FORMAT;
            await this.stateService.setState(state);

            await this.safeReply(
              ctx,
              this.formatReviewMessage(analysis.content),
              CallbackKeyboardBuilder.aiFormatReviewKeyboard(analysis.content),
            );
          } else {
            await this.safeReply(
              ctx,
              `🤖 <b>AI Yordamchi:</b>\n\n${analysis.content}`,
              CallbackKeyboardBuilder.startMenu(),
            );
          }
          break;
        }
      }
    } catch (error) {
      this.logger.error('onText da xatolik:', error);
      await ctx.reply('Xatolik yuz berdi.');
    }
  }

  @On('photo')
  async onPhoto(@Ctx() ctx: Context) {
    try {
      if (!ctx.from || !ctx.message || !('photo' in ctx.message)) return;
      const userId = BigInt(ctx.from.id);
      const state = await this.stateService.getState(userId);

      if (state.step === BotWizardStep.WAITING_FOR_CONTENT) {
        const photos = ctx.message.photo;
        const highestPhoto = photos[photos.length - 1];
        const caption = 'caption' in ctx.message ? ctx.message.caption || '' : '';

        if (caption.trim()) {
          const processingMsg = await ctx.reply('⏳ <i>Rasm izohi AI orqali chiroyli qilinmoqda...</i>', {
            parse_mode: 'HTML',
          });

          const beautified = await this.postFormatter.beautifyPost(caption);

          state.draftPost = {
            ...state.draftPost,
            mediaType: 'photo',
            mediaFileId: highestPhoto.file_id,
            rawText: caption,
            beautifiedText: beautified,
            text: beautified,
          };
          state.step = BotWizardStep.REVIEWING_AI_FORMAT;
          await this.stateService.setState(state);

          try {
            await ctx.deleteMessage(processingMsg.message_id);
          } catch (e) {}

          await this.safeReply(
            ctx,
            this.formatReviewMessage(beautified),
            CallbackKeyboardBuilder.aiFormatReviewKeyboard(beautified),
          );
        } else {
          state.draftPost = {
            ...state.draftPost,
            mediaType: 'photo',
            mediaFileId: highestPhoto.file_id,
          };
          state.step = BotWizardStep.SELECTING_TARGETS;
          await this.stateService.setState(state);

          const targets = await this.adminService.getAllTargets();
          await this.safeReply(
            ctx,
            MessageGenerator.selectTargetsMessage(targets, state.draftPost.selectedTargets || []),
            CallbackKeyboardBuilder.selectTargetsKeyboard(targets, state.draftPost.selectedTargets || []),
          );
        }
      }
    } catch (error) {
      this.logger.error('onPhoto da xatolik:', error);
      await ctx.reply('Rasmni qabul qilishda xatolik yuz berdi. Iltimos, qaytadan yuboring.');
    }
  }

  @On('video')
  async onVideo(@Ctx() ctx: Context) {
    try {
      if (!ctx.from || !ctx.message || !('video' in ctx.message)) return;
      const userId = BigInt(ctx.from.id);
      const state = await this.stateService.getState(userId);

      if (state.step === BotWizardStep.WAITING_FOR_CONTENT) {
        const video = ctx.message.video;
        const caption = 'caption' in ctx.message ? ctx.message.caption || '' : '';

        if (caption.trim()) {
          const processingMsg = await ctx.reply('⏳ <i>Video izohi AI orqali chiroyli qilinmoqda...</i>', {
            parse_mode: 'HTML',
          });

          const beautified = await this.postFormatter.beautifyPost(caption);

          state.draftPost = {
            ...state.draftPost,
            mediaType: 'video',
            mediaFileId: video.file_id,
            rawText: caption,
            beautifiedText: beautified,
            text: beautified,
          };
          state.step = BotWizardStep.REVIEWING_AI_FORMAT;
          await this.stateService.setState(state);

          try {
            await ctx.deleteMessage(processingMsg.message_id);
          } catch (e) {}

          await this.safeReply(
            ctx,
            this.formatReviewMessage(beautified),
            CallbackKeyboardBuilder.aiFormatReviewKeyboard(beautified),
          );
        } else {
          state.draftPost = {
            ...state.draftPost,
            mediaType: 'video',
            mediaFileId: video.file_id,
          };
          state.step = BotWizardStep.SELECTING_TARGETS;
          await this.stateService.setState(state);

          const targets = await this.adminService.getAllTargets();
          await this.safeReply(
            ctx,
            MessageGenerator.selectTargetsMessage(targets, state.draftPost.selectedTargets || []),
            CallbackKeyboardBuilder.selectTargetsKeyboard(targets, state.draftPost.selectedTargets || []),
          );
        }
      }
    } catch (error) {
      this.logger.error('onVideo da xatolik:', error);
      await ctx.reply('Videoni qabul qilishda xatolik yuz berdi. Iltimos, qaytadan yuboring.');
    }
  }

  @On('document')
  async onDocument(@Ctx() ctx: Context) {
    try {
      if (!ctx.from || !ctx.message || !('document' in ctx.message)) return;
      const userId = BigInt(ctx.from.id);
      const state = await this.stateService.getState(userId);

      if (state.step === BotWizardStep.WAITING_FOR_CONTENT) {
        const doc = ctx.message.document;
        const caption = 'caption' in ctx.message ? ctx.message.caption || '' : '';

        if (caption.trim()) {
          const processingMsg = await ctx.reply('⏳ <i>Hujjat izohi AI orqali chiroyli qilinmoqda...</i>', {
            parse_mode: 'HTML',
          });

          const beautified = await this.postFormatter.beautifyPost(caption);

          state.draftPost = {
            ...state.draftPost,
            mediaType: 'document',
            mediaFileId: doc.file_id,
            rawText: caption,
            beautifiedText: beautified,
            text: beautified,
          };
          state.step = BotWizardStep.REVIEWING_AI_FORMAT;
          await this.stateService.setState(state);

          try {
            await ctx.deleteMessage(processingMsg.message_id);
          } catch (e) {}

          await this.safeReply(
            ctx,
            this.formatReviewMessage(beautified),
            CallbackKeyboardBuilder.aiFormatReviewKeyboard(beautified),
          );
        } else {
          state.draftPost = {
            ...state.draftPost,
            mediaType: 'document',
            mediaFileId: doc.file_id,
          };
          state.step = BotWizardStep.SELECTING_TARGETS;
          await this.stateService.setState(state);

          const targets = await this.adminService.getAllTargets();
          await this.safeReply(
            ctx,
            MessageGenerator.selectTargetsMessage(targets, state.draftPost.selectedTargets || []),
            CallbackKeyboardBuilder.selectTargetsKeyboard(targets, state.draftPost.selectedTargets || []),
          );
        }
      }
    } catch (error) {
      this.logger.error('onDocument da xatolik:', error);
      await ctx.reply('Hujjatni qabul qilishda xatolik yuz berdi. Iltimos, qaytadan yuboring.');
    }
  }

  @On('voice')
  async onVoice(@Ctx() ctx: Context) {
    try {
      if (!ctx.from || !ctx.message || !('voice' in ctx.message)) return;
      const userId = BigInt(ctx.from.id);
      const state = await this.stateService.getState(userId);
      const voice = ctx.message.voice;

      const transcribingMsg = await ctx.reply(
        '🎙 <i>Ovozli xabar tinglanmoqda va matnga o\'girilmoqda...</i>',
        { parse_mode: 'HTML' },
      );

      const recognizedText = await this.voiceTranscriber.transcribeVoice(voice.file_id);

      try {
        await ctx.deleteMessage(transcribingMsg.message_id);
      } catch (e) {}

      if (!recognizedText || !recognizedText.trim()) {
        await ctx.reply(
          '⚠️ <b>Ovozli xabarni tushunib bo\'lmadi.</b>\n\nIltimos, shovqinsiz joyda aniqroq gapirib qaytadan yuboring yoki matn ko\'rinishida yozing.',
          { parse_mode: 'HTML' },
        );
        return;
      }

      if (state.step === BotWizardStep.WAITING_FOR_CONTENT) {
        const processingMsg = await ctx.reply(
          `📝 <b>Aniqlangan ovoz matni:</b>\n<i>"${recognizedText}"</i>\n\n⏳ <i>AI yordamida chiroyli postga aylantirilmoqda...</i>`,
          { parse_mode: 'HTML' },
        );

        const beautified = await this.postFormatter.beautifyPost(recognizedText);

        state.draftPost = {
          ...state.draftPost,
          rawText: recognizedText,
          beautifiedText: beautified,
          text: beautified,
        };
        state.step = BotWizardStep.REVIEWING_AI_FORMAT;
        await this.stateService.setState(state);

        try {
          await ctx.deleteMessage(processingMsg.message_id);
        } catch (e) {}

        await this.safeReply(
          ctx,
          this.formatReviewMessage(beautified),
          CallbackKeyboardBuilder.aiFormatReviewKeyboard(beautified),
        );
      } else {
        const processingMsg = await ctx.reply(
          `📝 <b>Aniqlangan ovoz:</b>\n<i>"${recognizedText}"</i>\n\n⏳ <i>AI orqali tahlil qilinmoqda...</i>`,
          { parse_mode: 'HTML' },
        );

        const analysis = await this.postFormatter.analyzeAndProcess(recognizedText);

        try {
          await ctx.deleteMessage(processingMsg.message_id);
        } catch (e) {}

        if (analysis.type === 'POST') {
          state.draftPost = {
            ...state.draftPost,
            rawText: recognizedText,
            beautifiedText: analysis.content,
            text: analysis.content,
          };
          state.step = BotWizardStep.REVIEWING_AI_FORMAT;
          await this.stateService.setState(state);

          await this.safeReply(
            ctx,
            this.formatReviewMessage(analysis.content),
            CallbackKeyboardBuilder.aiFormatReviewKeyboard(analysis.content),
          );
        } else {
          await this.safeReply(
            ctx,
            `🤖 <b>AI Yordamchi:</b>\n\n${analysis.content}`,
            CallbackKeyboardBuilder.startMenu(),
          );
        }
      }
    } catch (error) {
      this.logger.error('onVoice da xatolik:', error);
      await ctx.reply('Ovozli xabarni qayta ishlashda xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
    }
  }

  @On('audio')
  async onAudio(@Ctx() ctx: Context) {
    try {
      if (!ctx.from || !ctx.message || !('audio' in ctx.message)) return;
      const userId = BigInt(ctx.from.id);
      const state = await this.stateService.getState(userId);
      const audio = ctx.message.audio;

      const transcribingMsg = await ctx.reply(
        '🎙 <i>Audio fayl tinglanmoqda va matnga o\'girilmoqda...</i>',
        { parse_mode: 'HTML' },
      );

      const recognizedText = await this.voiceTranscriber.transcribeVoice(audio.file_id);

      try {
        await ctx.deleteMessage(transcribingMsg.message_id);
      } catch (e) {}

      if (!recognizedText || !recognizedText.trim()) {
        await ctx.reply(
          '⚠️ <b>Audiodan matn ajratib bo\'lmadi.</b>\n\nIltimos, qaytadan yuboring yoki matn ko\'rinishida yozing.',
          { parse_mode: 'HTML' },
        );
        return;
      }

      if (state.step === BotWizardStep.WAITING_FOR_CONTENT) {
        const beautified = await this.postFormatter.beautifyPost(recognizedText);

        state.draftPost = {
          ...state.draftPost,
          rawText: recognizedText,
          beautifiedText: beautified,
          text: beautified,
        };
        state.step = BotWizardStep.REVIEWING_AI_FORMAT;
        await this.stateService.setState(state);

        await this.safeReply(
          ctx,
          this.formatReviewMessage(beautified),
          CallbackKeyboardBuilder.aiFormatReviewKeyboard(beautified),
        );
      } else {
        const analysis = await this.postFormatter.analyzeAndProcess(recognizedText);

        if (analysis.type === 'POST') {
          state.draftPost = {
            ...state.draftPost,
            rawText: recognizedText,
            beautifiedText: analysis.content,
            text: analysis.content,
          };
          state.step = BotWizardStep.REVIEWING_AI_FORMAT;
          await this.stateService.setState(state);

          await this.safeReply(
            ctx,
            this.formatReviewMessage(analysis.content),
            CallbackKeyboardBuilder.aiFormatReviewKeyboard(analysis.content),
          );
        } else {
          await this.safeReply(
            ctx,
            `🤖 <b>AI Yordamchi:</b>\n\n${analysis.content}`,
            CallbackKeyboardBuilder.startMenu(),
          );
        }
      }
    } catch (error) {
      this.logger.error('onAudio da xatolik:', error);
      await ctx.reply('Audioni qayta ishlashda xatolik yuz berdi.');
    }
  }

  @Action('accept_ai_format')
  async onAcceptAiFormat(@Ctx() ctx: Context) {
    try {
      if (!ctx.from) return;
      const userId = BigInt(ctx.from.id);
      const state = await this.stateService.getState(userId);

      state.draftPost = {
        ...state.draftPost,
        text: state.draftPost?.beautifiedText || state.draftPost?.rawText,
      };
      state.step = BotWizardStep.SELECTING_TARGETS;
      await this.stateService.setState(state);

      await ctx.answerCbQuery('✨ AI formati qabul qilindi!');

      const targets = await this.adminService.getAllTargets();
      await this.safeEditMessageText(
        ctx,
        MessageGenerator.selectTargetsMessage(targets, state.draftPost.selectedTargets || []),
        CallbackKeyboardBuilder.selectTargetsKeyboard(targets, state.draftPost.selectedTargets || []),
      );
    } catch (error) {
      this.logger.error('onAcceptAiFormat da xatolik:', error);
    }
  }

  @Action('keep_raw_format')
  async onKeepRawFormat(@Ctx() ctx: Context) {
    try {
      if (!ctx.from) return;
      const userId = BigInt(ctx.from.id);
      const state = await this.stateService.getState(userId);

      state.draftPost = {
        ...state.draftPost,
        text: state.draftPost?.rawText || state.draftPost?.beautifiedText,
      };
      state.step = BotWizardStep.SELECTING_TARGETS;
      await this.stateService.setState(state);

      await ctx.answerCbQuery('📝 Asl matn qoldirildi.');

      const targets = await this.adminService.getAllTargets();
      await this.safeEditMessageText(
        ctx,
        MessageGenerator.selectTargetsMessage(targets, state.draftPost.selectedTargets || []),
        CallbackKeyboardBuilder.selectTargetsKeyboard(targets, state.draftPost.selectedTargets || []),
      );
    } catch (error) {
      this.logger.error('onKeepRawFormat da xatolik:', error);
    }
  }

  @Action(/toggle_target:(.+)/)
  async onToggleTarget(@Ctx() ctx: Context) {
    try {
      if (!ctx.from || !('match' in ctx)) return;
      const userId = BigInt(ctx.from.id);
      const targetId = (ctx as any).match[1];

      const state = await this.stateService.getState(userId);
      let selected = state.draftPost?.selectedTargets || [];

      if (selected.includes(targetId)) {
        selected = selected.filter((id) => id !== targetId);
      } else {
        selected.push(targetId);
      }

      state.draftPost = {
        ...state.draftPost,
        selectedTargets: selected,
      };
      await this.stateService.setState(state);

      const targets = await this.adminService.getAllTargets();
      await ctx.editMessageReplyMarkup(
        CallbackKeyboardBuilder.selectTargetsKeyboard(targets, selected).reply_markup,
      );
      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error('onToggleTarget da xatolik:', error);
    }
  }

  @Action('targets_done')
  async onTargetsDone(@Ctx() ctx: Context) {
    try {
      if (!ctx.from) return;
      const userId = BigInt(ctx.from.id);
      const state = await this.stateService.getState(userId);

      if (!state.draftPost?.selectedTargets || state.draftPost.selectedTargets.length === 0) {
        await ctx.answerCbQuery('Kamida 1 ta chatni tanlang!', { show_alert: true });
        return;
      }

      state.step = BotWizardStep.CHOOSING_SCHEDULE_TYPE;
      await this.stateService.setState(state);

      await this.safeEditMessageText(
        ctx,
        MessageGenerator.chooseScheduleTypeMessage(),
        CallbackKeyboardBuilder.chooseScheduleTypeKeyboard(),
      );
      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error('onTargetsDone da xatolik:', error);
    }
  }

  @Action('schedule_instant')
  async onScheduleInstant(@Ctx() ctx: Context) {
    try {
      if (!ctx.from) return;
      const userId = BigInt(ctx.from.id);
      const state = await this.stateService.getState(userId);

      if (!state.draftPost) {
        await ctx.answerCbQuery('E\'lon ma\'lumotlari topilmadi.');
        return;
      }

      await ctx.answerCbQuery('E\'lon yuborilmoqda...');
      await ctx.editMessageText('🚀 E\'lon tanlangan chatlarga yuborilmoqda...');

      const result = await this.postsService.createPost({
        userId,
        text: state.draftPost.text,
        mediaType: state.draftPost.mediaType,
        mediaFileId: state.draftPost.mediaFileId,
        targetIds: state.draftPost.selectedTargets || [],
        scheduledAt: null,
      });

      await this.stateService.clearState(userId);

      if (result.success) {
        await ctx.editMessageText('✅ <b>E\'lon barcha belgilangan chatlarga muvaffaqiyatli yuborildi!</b>', {
          parse_mode: 'HTML',
        });
      } else {
        await ctx.editMessageText(`❌ <b>E\'lon yuborishda xatolik yuz berdi:</b> ${result.message}`, {
          parse_mode: 'HTML',
        });
      }
    } catch (error) {
      this.logger.error('onScheduleInstant da xatolik:', error);
    }
  }

  @Action('schedule_custom')
  async onScheduleCustom(@Ctx() ctx: Context) {
    try {
      if (!ctx.from) return;
      const userId = BigInt(ctx.from.id);
      const state = await this.stateService.getState(userId);

      state.step = BotWizardStep.WAITING_FOR_DATE;
      await this.stateService.setState(state);

      await this.safeEditMessageText(ctx, MessageGenerator.askScheduleDateMessage());
      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error('onScheduleCustom da xatolik:', error);
    }
  }

  @Action('confirm_post_send')
  async onConfirmPostSend(@Ctx() ctx: Context) {
    try {
      if (!ctx.from) return;
      const userId = BigInt(ctx.from.id);
      const state = await this.stateService.getState(userId);

      if (!state.draftPost || !state.draftPost.scheduledAt) {
        await ctx.answerCbQuery('E\'lon ma\'lumotlari to\'liq emas.');
        return;
      }

      await ctx.answerCbQuery('Rejalashtirilmoqda...');
      await ctx.editMessageText('⏳ E\'lon navbatga qo\'yilmoqda...');

      const result = await this.postsService.createPost({
        userId,
        text: state.draftPost.text,
        mediaType: state.draftPost.mediaType,
        mediaFileId: state.draftPost.mediaFileId,
        targetIds: state.draftPost.selectedTargets || [],
        scheduledAt: state.draftPost.scheduledAt,
      });

      await this.stateService.clearState(userId);

      if (result.success) {
        await ctx.editMessageText(
          `✅ <b>E'lon muvaffaqiyatli rejalashtirildi!</b>\n⏰ Belgilangan vaqtda avtomatik yuboriladi.`,
          { parse_mode: 'HTML' },
        );
      } else {
        await ctx.editMessageText(
          `❌ <b>Rejalashtirishda xatolik:</b> ${result.message}`,
          { parse_mode: 'HTML' },
        );
      }
    } catch (error) {
      this.logger.error('onConfirmPostSend da xatolik:', error);
    }
  }

  @Action(/switch_posts:(.+)/)
  async onSwitchPosts(@Ctx() ctx: Context) {
    try {
      if (!('match' in ctx)) return;
      const category = (ctx as any).match[1] as 'SCHEDULED' | 'SENT';

      const posts = await this.postsService.listPosts(category);
      const title =
        category === 'SCHEDULED'
          ? '⏰ <b>Kutilayotgan (Rejalashtirilgan) E\'lonlar:</b>\n\n'
          : '🗄 <b>Arxiv (Yuborilgan) E\'lonlar:</b>\n\n';

      let text = title;
      if (posts.length === 0) {
        text += '<i>Ushbu toifada e\'lonlar mavjud emas.</i>';
      }

      await this.safeEditMessageText(
        ctx,
        text,
        CallbackKeyboardBuilder.postsListKeyboard(posts, category),
      );
      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error('onSwitchPosts da xatolik:', error);
    }
  }

  @Action(/view_post:(.+)/)
  async onViewPost(@Ctx() ctx: Context) {
    try {
      if (!ctx.from || !('match' in ctx)) return;
      const userId = BigInt(ctx.from.id);
      const postId = (ctx as any).match[1];

      const post = await this.postsService.getPostDetail(postId);
      if (!post) {
        await ctx.answerCbQuery('Post topilmadi.');
        return;
      }

      // Post kutilayotgan yoki arxivda bo'lsa ham, tahrirlash uchun state o'rnatamiz
      await this.stateService.setState({
        userId,
        step: BotWizardStep.EDITING_EXISTING_POST,
        editingPostId: post.id,
      });

      const previewText = MessageGenerator.postPreviewMessage({
        text: post.text,
        mediaType: post.mediaType,
        scheduledAt: post.scheduledAt,
        status: post.status,
        targetsCount: post.targets.length,
        createdAt: post.createdAt,
      });

      await this.safeEditMessageText(
        ctx,
        previewText,
        CallbackKeyboardBuilder.postDetailKeyboard(post.id, post.status, post.text || undefined),
      );
      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error('onViewPost da xatolik:', error);
    }
  }

  @Action(/ai_reformat:(.+)/)
  async onAiReformat(@Ctx() ctx: Context) {
    try {
      if (!ctx.from || !('match' in ctx)) return;
      const userId = BigInt(ctx.from.id);
      const postId = (ctx as any).match[1];

      const post = await this.postsService.getPostDetail(postId);
      if (!post || !post.text) {
        await ctx.answerCbQuery('Post matni topilmadi.', { show_alert: true });
        return;
      }

      await ctx.answerCbQuery('AI matnni qayta ko\'rib chiqmoqda...');
      const loadingMsg = await ctx.reply('⏳ <i>Post matni AI yordamida qayta formatlanmoqda...</i>', {
        parse_mode: 'HTML',
      });

      const beautified = await this.postFormatter.beautifyPost(post.text);

      try {
        await ctx.deleteMessage(loadingMsg.message_id);
      } catch (e) {}

      // Vaqtinchalik sessiyada yangi taklif qilingan matnni saqlaymiz
      await this.stateService.setState({
        userId,
        step: BotWizardStep.EDITING_EXISTING_POST,
        editingPostId: postId,
        tempData: { reformattedText: beautified },
      });

      const previewText =
        `✨ <b>AI taklif qilgan yangi format:</b>\n\n${beautified}\n\n` +
        `<i>Ushbu yangi formatni qabul qilasizmi?</i>`;

      await this.safeEditMessageText(
        ctx,
        previewText,
        CallbackKeyboardBuilder.reformatConfirmKeyboard(postId),
      );
    } catch (error) {
      this.logger.error('onAiReformat da xatolik:', error);
      await ctx.reply('AI qayta formatlashda xatolik yuz berdi.');
    }
  }

  @Action(/apply_ai_reformat:(.+)/)
  async onApplyAiReformat(@Ctx() ctx: Context) {
    try {
      if (!ctx.from || !('match' in ctx)) return;
      const userId = BigInt(ctx.from.id);
      const postId = (ctx as any).match[1];

      const state = await this.stateService.getState(userId);
      const reformattedText = state.tempData?.reformattedText;

      if (!reformattedText) {
        await ctx.answerCbQuery('Qayta formatlangan matn topilmadi.', { show_alert: true });
        return;
      }

      const updateResult = await this.postsService.updatePostText(postId, reformattedText);
      await this.stateService.clearState(userId);

      if (updateResult.success) {
        let alertMsg = '✅ Post AI yordamida yangilandi!';
        if (updateResult.isSent) {
          alertMsg = `✅ Yuborilgan xabar Telegramda jonli tahrirlandi (${updateResult.editSuccessCount} ta chat)!`;
        }
        await ctx.answerCbQuery(alertMsg, { show_alert: true });

        const updatedPost = await this.postsService.getPostDetail(postId);
        if (updatedPost) {
          const previewText = MessageGenerator.postPreviewMessage({
            text: updatedPost.text,
            mediaType: updatedPost.mediaType,
            scheduledAt: updatedPost.scheduledAt,
            status: updatedPost.status,
            targetsCount: updatedPost.targets.length,
            createdAt: updatedPost.createdAt,
          });

          await this.safeEditMessageText(
            ctx,
            previewText,
            CallbackKeyboardBuilder.postDetailKeyboard(
              updatedPost.id,
              updatedPost.status,
              updatedPost.text || undefined,
            ),
          );
        }
      } else {
        await ctx.reply(`❌ Xatolik: ${updateResult.message}`);
      }
    } catch (error) {
      this.logger.error('onApplyAiReformat da xatolik:', error);
    }
  }

  @Action(/cancel_ai_reformat:(.+)/)
  async onCancelAiReformat(@Ctx() ctx: Context) {
    try {
      if (!ctx.from || !('match' in ctx)) return;
      const userId = BigInt(ctx.from.id);
      const postId = (ctx as any).match[1];

      await this.stateService.clearState(userId);
      await ctx.answerCbQuery('Qayta formatlash bekor qilindi.');

      const post = await this.postsService.getPostDetail(postId);
      if (post) {
        const previewText = MessageGenerator.postPreviewMessage({
          text: post.text,
          mediaType: post.mediaType,
          scheduledAt: post.scheduledAt,
          status: post.status,
          targetsCount: post.targets.length,
          createdAt: post.createdAt,
        });

        await this.safeEditMessageText(
          ctx,
          previewText,
          CallbackKeyboardBuilder.postDetailKeyboard(
            post.id,
            post.status,
            post.text || undefined,
          ),
        );
      }
    } catch (error) {
      this.logger.error('onCancelAiReformat da xatolik:', error);
    }
  }

  @Action(/send_now:(.+)/)
  async onSendNow(@Ctx() ctx: Context) {
    try {
      if (!('match' in ctx)) return;
      const postId = (ctx as any).match[1];

      await ctx.answerCbQuery('Yuborilmoqda...');
      await this.postsService.sendPostNow(postId);

      await ctx.editMessageText('✅ Post darhol barcha chatlarga yuborildi!');
    } catch (error) {
      this.logger.error('onSendNow da xatolik:', error);
    }
  }

  @Action(/delete_post:(.+)/)
  async onDeletePost(@Ctx() ctx: Context) {
    try {
      if (!ctx.from || !('match' in ctx)) return;
      const userId = BigInt(ctx.from.id);
      const postId = (ctx as any).match[1];

      // Post tafsilotlarini o'chirishdan oldin toifani aniqlaymiz
      const post = await this.postsService.getPostDetail(postId);
      const category: 'SCHEDULED' | 'SENT' = post?.status === 'SENT' ? 'SENT' : 'SCHEDULED';

      await this.postsService.deletePost(postId);
      await this.stateService.clearState(userId);
      await ctx.answerCbQuery('🗑 Post o\'chirildi va chat tozalandi.', { show_alert: true });

      // Chatdagi post xabarini tozalaymiz / o'chiramiz
      try {
        await ctx.deleteMessage();
      } catch (delErr) {}

      // Yangilangan postlar ro'yxatini chiqaramiz
      const posts = await this.postsService.listPosts(category);
      const title =
        category === 'SCHEDULED'
          ? '⏰ <b>Kutilayotgan (Rejalashtirilgan) E\'lonlar:</b>\n\n'
          : '🗄 <b>Arxiv (Yuborilgan) E\'lonlar:</b>\n\n';

      let text = title;
      if (posts.length === 0) {
        text += '<i>Ushbu toifada e\'lonlar mavjud emas.</i>';
      }

      await this.safeReply(
        ctx,
        text,
        CallbackKeyboardBuilder.postsListKeyboard(posts, category),
      );
    } catch (error) {
      this.logger.error('onDeletePost da xatolik:', error);
    }
  }

  @Action('add_channel')
  async onAddChannel(@Ctx() ctx: Context) {
    try {
      if (!ctx.from) return;
      const userId = BigInt(ctx.from.id);

      await this.stateService.setState({
        userId,
        step: BotWizardStep.ADDING_CHANNEL,
      });

      await this.safeEditMessageText(
        ctx,
        '📢 <b>Qo\'shmoqchi bo\'lgan kanalingiz ID si, @username yoki havolasini yuboring:</b>\n\n' +
        '<i>Eslatma: Kanalga avval botni administrator qilib qo\'shganingizga ishonch hosil qiling!</i>',
      );
      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error('onAddChannel da xatolik:', error);
    }
  }

  @Action(/delete_channel:(.+)/)
  async onDeleteChannel(@Ctx() ctx: Context) {
    try {
      if (!('match' in ctx)) return;
      const channelId = (ctx as any).match[1];

      await this.channelsService.deleteChannel(channelId);
      await ctx.answerCbQuery('Kanal o\'chirildi.');

      const channels = await this.channelsService.listChannels();
      await this.safeEditMessageText(
        ctx,
        '📢 <b>Kanallar yangilandi:</b>',
        CallbackKeyboardBuilder.channelsMenuKeyboard(channels),
      );
    } catch (error) {
      this.logger.error('onDeleteChannel da xatolik:', error);
    }
  }

  @Action('add_group')
  async onAddGroup(@Ctx() ctx: Context) {
    try {
      if (!ctx.from) return;
      const userId = BigInt(ctx.from.id);

      await this.stateService.setState({
        userId,
        step: BotWizardStep.ADDING_GROUP,
      });

      await this.safeEditMessageText(
        ctx,
        '👥 <b>Qo\'shmoqchi bo\'lgan guruhingiz ID si yoki @username ini yuboring:</b>\n\n' +
        '<i>Eslatma: Guruhga avval botni a\'zo yoki administrator qilib qo\'shganingizga ishonch hosil qiling!</i>',
      );
      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error('onAddGroup da xatolik:', error);
    }
  }

  @Action(/delete_group:(.+)/)
  async onDeleteGroup(@Ctx() ctx: Context) {
    try {
      if (!('match' in ctx)) return;
      const groupId = (ctx as any).match[1];

      await this.groupsService.deleteGroup(groupId);
      await ctx.answerCbQuery('Guruh o\'chirildi.');

      const groups = await this.groupsService.listGroups();
      await this.safeEditMessageText(
        ctx,
        '👥 <b>Guruhlar yangilandi:</b>',
        CallbackKeyboardBuilder.groupsMenuKeyboard(groups),
      );
    } catch (error) {
      this.logger.error('onDeleteGroup da xatolik:', error);
    }
  }

  @Action('cancel_action')
  async onCancelAction(@Ctx() ctx: Context) {
    try {
      if (ctx.from) {
        await this.stateService.clearState(BigInt(ctx.from.id));
      }
      await ctx.answerCbQuery('❌ Amal bekor qilindi.', { show_alert: false });
      try {
        await ctx.deleteMessage();
      } catch (delErr) {
        await ctx.editMessageText('❌ Amal bekor qilindi.');
      }
    } catch (error) {
      this.logger.error('onCancelAction da xatolik:', error);
    }
  }

  @Action(/back_to_posts(?::(.+))?/)
  async onBackToPosts(@Ctx() ctx: Context) {
    try {
      if (ctx.from) {
        await this.stateService.clearState(BigInt(ctx.from.id));
      }

      const match = (ctx as any).match;
      const category: 'SCHEDULED' | 'SENT' = (match && match[1] === 'SENT') ? 'SENT' : 'SCHEDULED';

      const posts = await this.postsService.listPosts(category);
      const title =
        category === 'SCHEDULED'
          ? '⏰ <b>Kutilayotgan (Rejalashtirilgan) E\'lonlar:</b>\n\n'
          : '🗄 <b>Arxiv (Yuborilgan) E\'lonlar:</b>\n\n';

      let text = title;
      if (posts.length === 0) {
        text += '<i>Ushbu toifada e\'lonlar mavjud emas.</i>';
      }

      await this.safeEditMessageText(
        ctx,
        text,
        CallbackKeyboardBuilder.postsListKeyboard(posts, category),
      );
      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error('onBackToPosts da xatolik:', error);
    }
  }
}
