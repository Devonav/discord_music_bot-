require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const config = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const queue = new Map();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const serverQueue = queue.get(message.guild.id);

    switch (command) {
        case 'play':
            await play(message, args);
            break;
        case 'skip':
            skip(message, serverQueue);
            break;
        case 'stop':
            stop(message, serverQueue);
            break;
        case 'queue':
            showQueue(message, serverQueue);
            break;
        case 'pause':
            pause(message, serverQueue);
            break;
        case 'resume':
            resume(message, serverQueue);
            break;
        case 'help':
            showHelp(message);
            break;
    }
});

async function play(message, args) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
        return message.reply('You need to be in a voice channel to play music!');
    }

    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
        return message.reply('I need the permissions to join and speak in your voice channel!');
    }

    const url = args[0];
    if (!url) {
        return message.reply('Please provide a YouTube URL!');
    }

    if (!ytdl.validateURL(url)) {
        return message.reply('Please provide a valid YouTube URL!');
    }

    let songInfo;
    try {
        songInfo = await ytdl.getInfo(url);
    } catch (error) {
        console.error(error);
        return message.reply('There was an error getting song information!');
    }

    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
        duration: songInfo.videoDetails.lengthSeconds,
        thumbnail: songInfo.videoDetails.thumbnails[0].url,
        requestedBy: message.author.tag
    };

    const queueConstruct = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        player: null,
        songs: [],
        playing: true
    };

    const serverQueue = queue.get(message.guild.id);

    if (serverQueue) {
        serverQueue.songs.push(song);
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Song Added to Queue')
            .setDescription(`**${song.title}** has been added to the queue!`)
            .setThumbnail(song.thumbnail)
            .addFields(
                { name: 'Requested by', value: song.requestedBy, inline: true },
                { name: 'Position in queue', value: serverQueue.songs.length.toString(), inline: true }
            );
        return message.channel.send({ embeds: [embed] });
    }

    queueConstruct.songs.push(song);
    queue.set(message.guild.id, queueConstruct);

    try {
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
        });

        queueConstruct.connection = connection;
        queueConstruct.player = createAudioPlayer();

        connection.subscribe(queueConstruct.player);

        connection.on(VoiceConnectionStatus.Disconnected, () => {
            queue.delete(message.guild.id);
        });

        playStream(message.guild, queueConstruct.songs[0]);
    } catch (error) {
        console.error(error);
        queue.delete(message.guild.id);
        return message.reply('There was an error connecting to the voice channel!');
    }
}

function playStream(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.connection.destroy();
        queue.delete(guild.id);
        return;
    }

    try {
        const stream = ytdl(song.url, { 
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25
        });
        
        const resource = createAudioResource(stream);
        serverQueue.player.play(resource);

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('Now Playing')
            .setDescription(`**${song.title}**`)
            .setThumbnail(song.thumbnail)
            .addFields(
                { name: 'Requested by', value: song.requestedBy, inline: true },
                { name: 'Duration', value: formatDuration(song.duration), inline: true }
            );

        serverQueue.textChannel.send({ embeds: [embed] });

        serverQueue.player.on(AudioPlayerStatus.Idle, () => {
            serverQueue.songs.shift();
            playStream(guild, serverQueue.songs[0]);
        });

        serverQueue.player.on('error', error => {
            console.error(error);
            serverQueue.songs.shift();
            playStream(guild, serverQueue.songs[0]);
        });
    } catch (error) {
        console.error(error);
        serverQueue.textChannel.send('There was an error playing the song!');
        serverQueue.songs.shift();
        playStream(guild, serverQueue.songs[0]);
    }
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel) {
        return message.reply('You need to be in a voice channel to skip music!');
    }
    if (!serverQueue) {
        return message.reply('There is nothing playing that I could skip!');
    }

    serverQueue.player.stop();
    message.react('⏭️');
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel) {
        return message.reply('You need to be in a voice channel to stop music!');
    }
    if (!serverQueue) {
        return message.reply('There is nothing playing that I could stop!');
    }

    serverQueue.songs = [];
    serverQueue.player.stop();
    serverQueue.connection.destroy();
    queue.delete(message.guild.id);
    message.react('⏹️');
}

function pause(message, serverQueue) {
    if (!message.member.voice.channel) {
        return message.reply('You need to be in a voice channel to pause music!');
    }
    if (!serverQueue || !serverQueue.playing) {
        return message.reply('There is nothing playing that I could pause!');
    }

    serverQueue.player.pause();
    serverQueue.playing = false;
    message.react('⏸️');
}

function resume(message, serverQueue) {
    if (!message.member.voice.channel) {
        return message.reply('You need to be in a voice channel to resume music!');
    }
    if (!serverQueue || serverQueue.playing) {
        return message.reply('There is nothing paused that I could resume!');
    }

    serverQueue.player.unpause();
    serverQueue.playing = true;
    message.react('▶️');
}

function showQueue(message, serverQueue) {
    if (!serverQueue || serverQueue.songs.length === 0) {
        return message.reply('The queue is empty!');
    }

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Music Queue')
        .setDescription(
            serverQueue.songs
                .slice(0, 10)
                .map((song, index) => `${index === 0 ? '🎵 **Now Playing:**' : `${index}.`} ${song.title} - *Requested by ${song.requestedBy}*`)
                .join('\n')
        );

    if (serverQueue.songs.length > 10) {
        embed.setFooter({ text: `And ${serverQueue.songs.length - 10} more songs...` });
    }

    message.channel.send({ embeds: [embed] });
}

function showHelp(message) {
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Music Bot Commands')
        .setDescription('Here are all the available commands:')
        .addFields(
            { name: `${config.prefix}play <YouTube URL>`, value: 'Play a song from YouTube', inline: false },
            { name: `${config.prefix}skip`, value: 'Skip the current song', inline: false },
            { name: `${config.prefix}stop`, value: 'Stop playing and clear the queue', inline: false },
            { name: `${config.prefix}pause`, value: 'Pause the current song', inline: false },
            { name: `${config.prefix}resume`, value: 'Resume the paused song', inline: false },
            { name: `${config.prefix}queue`, value: 'Show the current queue', inline: false },
            { name: `${config.prefix}help`, value: 'Show this help message', inline: false }
        );

    message.channel.send({ embeds: [embed] });
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

client.login(process.env.DISCORD_TOKEN || config.token);