import { UseGuards, Logger } from '@nestjs/common';
import { Update, Ctx, Start, Command, Hears, On, Action } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { UserFilterGuard } from 'src/global/user_filter/user_filter.guard';
import { StateService } from 'src/core/state.service';
import { ChannelsService } from 'src/modules/channels/channels.service';
import { GroupsService } from 'src/modules/groups/groups.service';
import { PostsService } from 'src/modules/posts/posts.service';
import { PostFormatterService } from 'src/core/post_formatter.service';
import { AdminService } from './admin.service';
import { MessageGenerator } from 'src/common/utils/_message_generator';
import { CallbackKeyboardBuilder } from 'src/common/utils/_cb_functions';
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
    private readonly adminService: AdminService,
  ) {}

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
      await ctx.reply(MessageGenerator.welcomeMessage(name), {
        parse_mode: 'HTML',
        ...CallbackKeyboardBuilder.startMenu(),
      });
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

      await ctx.reply(MessageGenerator.askPostContent(), { parse_mode: 'HTML' });
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

      await ctx.reply(text, {
        parse_mode: 'HTML',
        ...CallbackKeyboardBuilder.channelsMenuKeyboard(channels),
      });
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

      await ctx.reply(text, {
        parse_mode: 'HTML',
        ...CallbackKeyboardBuilder.groupsMenuKeyboard(groups),
      });
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

      await ctx.reply(text, {
        parse_mode: 'HTML',
        ...CallbackKeyboardBuilder.postsListKeyboard(posts, 'SCHEDULED'),
      });
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
            text: beautified, // default taklif
          };
          state.step = BotWizardStep.REVIEWING_AI_FORMAT;
          await this.stateService.setState(state);

          try {
            await ctx.deleteMessage(processingMsg.message_id);
          } catch (e) {}

          await ctx.reply(
            `✨ <b>Formatlangan post ko'rinishi:</b>\n\n${beautified}\n\n───────────────\n<i>Quyidagi variantlardan birini tanlang:</i>`,
            {
              parse_mode: 'HTML',
              ...CallbackKeyboardBuilder.aiFormatReviewKeyboard(),
            },
          );
          break;
        }

        case BotWizardStep.WAITING_FOR_DATE: {
          const parsedDate = new Date(text.replace(' ', 'T') + ':00+05:00');
          if (isNaN(parsedDate.getTime()) || parsedDate.getTime() <= Date.now()) {
            await ctx.reply(
              '⚠️ <b>Noto\'g\'ri sana/vaqt formati yoki o\'tgan vaqt kiritildi!</b>\n\nIltimos, qaytadan kiriting:\nMisol: <code>2026-09-07 18:30</code>',
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

          await ctx.reply(previewText, {
            parse_mode: 'HTML',
            ...CallbackKeyboardBuilder.confirmPostKeyboard(),
          });
          break;
        }

        case BotWizardStep.ADDING_CHANNEL: {
          const res = await this.channelsService.addChannel(text);
          if (res.success) {
            await ctx.reply(
              MessageGenerator.channelHealthCheckSuccess(res.title, res.username),
              { parse_mode: 'HTML', ...CallbackKeyboardBuilder.startMenu() },
            );
          } else {
            await ctx.reply(
              MessageGenerator.channelHealthCheckFailed(text, res.message || 'Noma\'lum xatolik'),
              { parse_mode: 'HTML', ...CallbackKeyboardBuilder.startMenu() },
            );
          }
          await this.stateService.clearState(userId);
          break;
        }

        case BotWizardStep.ADDING_GROUP: {
          const res = await this.groupsService.addGroup(text);
          if (res.success) {
            await ctx.reply(
              `✅ <b>Guruh muvaffaqiyatli qo'shildi!</b>\n\n📌 <b>Nomi:</b> ${res.title}`,
              { parse_mode: 'HTML', ...CallbackKeyboardBuilder.startMenu() },
            );
          } else {
            await ctx.reply(
              `❌ <b>Guruhni qo'shishda xatolik:</b>\n${res.message}`,
              { parse_mode: 'HTML', ...CallbackKeyboardBuilder.startMenu() },
            );
          }
          await this.stateService.clearState(userId);
          break;
        }

        default: {
          await ctx.reply(
            'Bosh menyudasiz. Quyidagi menyulardan birini tanlang:',
            CallbackKeyboardBuilder.startMenu(),
          );
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

          await ctx.reply(
            `✨ <b>Formatlangan izoh ko'rinishi:</b>\n\n${beautified}\n\n───────────────\n<i>Quyidagi variantlardan birini tanlang:</i>`,
            {
              parse_mode: 'HTML',
              ...CallbackKeyboardBuilder.aiFormatReviewKeyboard(),
            },
          );
        } else {
          // Izohsiz rasm bo'lsa to'g'ridan-to'g'ri kanallarni tanlashga o'tadi
          state.draftPost = {
            ...state.draftPost,
            mediaType: 'photo',
            mediaFileId: highestPhoto.file_id,
          };
          state.step = BotWizardStep.SELECTING_TARGETS;
          await this.stateService.setState(state);

          const targets = await this.adminService.getAllTargets();
          await ctx.reply(
            MessageGenerator.selectTargetsMessage(targets, state.draftPost.selectedTargets || []),
            {
              parse_mode: 'HTML',
              ...CallbackKeyboardBuilder.selectTargetsKeyboard(targets, state.draftPost.selectedTargets || []),
            },
          );
        }
      }
    } catch (error) {
      this.logger.error('onPhoto da xatolik:', error);
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

          await ctx.reply(
            `✨ <b>Formatlangan izoh ko'rinishi:</b>\n\n${beautified}\n\n───────────────\n<i>Quyidagi variantlardan birini tanlang:</i>`,
            {
              parse_mode: 'HTML',
              ...CallbackKeyboardBuilder.aiFormatReviewKeyboard(),
            },
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
          await ctx.reply(
            MessageGenerator.selectTargetsMessage(targets, state.draftPost.selectedTargets || []),
            {
              parse_mode: 'HTML',
              ...CallbackKeyboardBuilder.selectTargetsKeyboard(targets, state.draftPost.selectedTargets || []),
            },
          );
        }
      }
    } catch (error) {
      this.logger.error('onVideo da xatolik:', error);
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
      await ctx.editMessageText(
        MessageGenerator.selectTargetsMessage(targets, state.draftPost.selectedTargets || []),
        {
          parse_mode: 'HTML',
          ...CallbackKeyboardBuilder.selectTargetsKeyboard(targets, state.draftPost.selectedTargets || []),
        },
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
      await ctx.editMessageText(
        MessageGenerator.selectTargetsMessage(targets, state.draftPost.selectedTargets || []),
        {
          parse_mode: 'HTML',
          ...CallbackKeyboardBuilder.selectTargetsKeyboard(targets, state.draftPost.selectedTargets || []),
        },
      );
    } catch (error) {
      this.logger.error('onKeepRawFormat da xatolik:', error);
    }
  }

  @Action('rewrite_content')
  async onRewriteContent(@Ctx() ctx: Context) {
    try {
      if (!ctx.from) return;
      const userId = BigInt(ctx.from.id);
      const state = await this.stateService.getState(userId);

      state.step = BotWizardStep.WAITING_FOR_CONTENT;
      await this.stateService.setState(state);

      await ctx.answerCbQuery();
      await ctx.editMessageText(
        '✏️ <b>Yangi matn yoki mediani yuboring:</b>',
        { parse_mode: 'HTML' },
      );
    } catch (error) {
      this.logger.error('onRewriteContent da xatolik:', error);
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

      await ctx.editMessageText(MessageGenerator.chooseScheduleTypeMessage(), {
        parse_mode: 'HTML',
        ...CallbackKeyboardBuilder.chooseScheduleTypeKeyboard(),
      });
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
        await ctx.reply('✅ <b>E\'lon barcha belgilangan chatlarga yuborildi!</b>', {
          parse_mode: 'HTML',
          ...CallbackKeyboardBuilder.startMenu(),
        });
      } else {
        await ctx.reply(`❌ <b>E\'lon yuborishda xatolik yuz berdi:</b> ${result.message}`, {
          parse_mode: 'HTML',
          ...CallbackKeyboardBuilder.startMenu(),
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

      await ctx.editMessageText(MessageGenerator.askScheduleDateMessage(), {
        parse_mode: 'HTML',
      });
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
        await ctx.reply(
          `✅ <b>E'lon muvaffaqiyatli rejalashtirildi!</b>\n⏰ Belgilangan vaqtda avtomatik yuboriladi.`,
          { parse_mode: 'HTML', ...CallbackKeyboardBuilder.startMenu() },
        );
      } else {
        await ctx.reply(`❌ <b>Rejalashtirishda xatolik:</b> ${result.message}`, {
          parse_mode: 'HTML',
          ...CallbackKeyboardBuilder.startMenu(),
        });
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

      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...CallbackKeyboardBuilder.postsListKeyboard(posts, category),
      });
      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error('onSwitchPosts da xatolik:', error);
    }
  }

  @Action(/view_post:(.+)/)
  async onViewPost(@Ctx() ctx: Context) {
    try {
      if (!('match' in ctx)) return;
      const postId = (ctx as any).match[1];

      const post = await this.postsService.getPostDetail(postId);
      if (!post) {
        await ctx.answerCbQuery('Post topilmadi.');
        return;
      }

      const previewText = MessageGenerator.postPreviewMessage({
        text: post.text,
        mediaType: post.mediaType,
        scheduledAt: post.scheduledAt,
        status: post.status,
        targetsCount: post.targets.length,
        createdAt: post.createdAt,
      });

      await ctx.editMessageText(previewText, {
        parse_mode: 'HTML',
        ...CallbackKeyboardBuilder.postDetailKeyboard(post.id, post.status),
      });
      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error('onViewPost da xatolik:', error);
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
      if (!('match' in ctx)) return;
      const postId = (ctx as any).match[1];

      await this.postsService.deletePost(postId);
      await ctx.answerCbQuery('Post o\'chirildi.');
      await ctx.editMessageText('🗑 Post muvaffaqiyatli o\'chirildi.');
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

      await ctx.editMessageText(
        '📢 <b>Qo\'shmoqchi bo\'lgan kanalingiz ID si, @username yoki havolasini yuboring:</b>\n\n' +
        '<i>Eslatma: Kanalga avval botni administrator qilib qo\'shganingizga ishonch hosil qiling!</i>',
        { parse_mode: 'HTML' },
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
      await ctx.editMessageText('📢 <b>Kanallar yangilandi:</b>', {
        parse_mode: 'HTML',
        ...CallbackKeyboardBuilder.channelsMenuKeyboard(channels),
      });
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

      await ctx.editMessageText(
        '👥 <b>Qo\'shmoqchi bo\'lgan guruhingiz ID si yoki @username ini yuboring:</b>\n\n' +
        '<i>Eslatma: Guruhga avval botni a\'zo yoki administrator qilib qo\'shganingizga ishonch hosil qiling!</i>',
        { parse_mode: 'HTML' },
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
      await ctx.editMessageText('👥 <b>Guruhlar yangilandi:</b>', {
        parse_mode: 'HTML',
        ...CallbackKeyboardBuilder.groupsMenuKeyboard(groups),
      });
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
      await ctx.answerCbQuery('Amal bekor qilindi.');
      await ctx.editMessageText('❌ Amal bekor qilindi.');
    } catch (error) {
      this.logger.error('onCancelAction da xatolik:', error);
    }
  }

  @Action('back_to_posts')
  async onBackToPosts(@Ctx() ctx: Context) {
    try {
      const posts = await this.postsService.listPosts('SCHEDULED');
      let text = '⏰ <b>Kutilayotgan (Rejalashtirilgan) E\'lonlar:</b>\n\n';

      if (posts.length === 0) {
        text += '<i>Kutilayotgan e\'lonlar mavjud emas.</i>';
      }

      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...CallbackKeyboardBuilder.postsListKeyboard(posts, 'SCHEDULED'),
      });
      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error('onBackToPosts da xatolik:', error);
    }
  }
}
