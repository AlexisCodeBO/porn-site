const express = require('express');
const hbs = require('hbs');
const bodyParser = require('body-parser');
const axios = require('axios');

var methodOverride = require('method-override');
var {mongoose} = require('./server/db/mongoose');
var {Video} = require('./server/models/video');

var app = express();

const port = 3000;

app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.set('view engine', 'hbs');
app.use(express.static(__dirname + '/public'));
hbs.registerPartials(__dirname + '/views/partials');

app.get('/favorites', (req,res) => {
    Video.find().then((videos) => {
        res.render('favorites', {result: videos});
    }).catch((e) => res.status(400).send());

});

app.get('/about', (req,res) => {
    res.render('about');
})

app.get('/video/:id', (req,res) => {
    const id = req.params.id;
    axios.get(`https://api.redtube.com/?data=redtube.Videos.getVideoById&video_id=${id}&output=json&thumbsize=all`)
         .then((video) => {    
            if(video.data.code && video.data.code !== 200) 
                return res.render('error', {error_code: 404, error_message: "Video not found."});        
            axios.get(` https://api.redtube.com/?data=redtube.Videos.getVideoEmbedCode&video_id=${id}&output=json`)
                 .then(embed => {      
                    if(embed.data.code && embed.data.code !== 200)       
                        return res.render('error', {error_code: 404, error_message: "Embed not found"});
                    const buffer = new Buffer(embed.data.embed.code, 'base64');  
                    const embed_video = buffer.toString('ascii');

                    res.status(200).render('video', {result: video.data.video, embed: embed_video});
                 })
                 .catch((e) => res.status(400).send(e));    
         })
         .catch((e) => res.status(400).send(e));
});

app.get('/save/:id', (req,res) => {
    const id = req.params.id;
    const backURL = req.header('Referer') || '/';
    axios.get(`https://api.redtube.com/?data=redtube.Videos.getVideoById&video_id=${id}&output=json&thumbsize=all`)
         .then((video) => {
            if(video.data.code && video.data.code !== 200)
                return res.render('error', {error_code: 404, error_message: "Video not found"});
            video = video.data.video;
            
            const videom = new Video({
                video_id: video.video_id,
                title: video.title,
                thumb: video.thumb
            });

            videom.save().then((nvideo) => {
                if(!nvideo) 
                    return res.render('error', {error_code: 400, error_message: "There were an error saving your video."})
                res.redirect(backURL);
            }).catch((e) => res.status(400).send(e));
         }).catch((e) => res.status(400).send(e));
});

app.delete('/delete/:id', (req,res) => {
    const id = req.params.id;
    const backURL = req.header('Referer') || '/';

    Video.findByIdAndRemove(id).then((video) => {
        if(!video) return res.render('error', {error_code: 400, error_message: "There were an error deleting your video."})
        res.redirect(backURL);
    }).catch((e) => console.log(e));
})

app.get('/:page?/:find?', (req,res) => {
    var page = parseInt(req.params.page);
    if(!page) page = 1;
    const next = page+1;
    const back = page-1;

    var find = req.params.find;
    if(!find) find = "";

    axios.get(`https://api.redtube.com/?data=redtube.Videos.searchVideos&output=json&thumbsize=large&page=${page}&search=${find}`)
        .then((videos) => {
            if(videos.data.count == 0 || (videos.data.code && videos.data.code !== 200)) 
                return res.render('error.hbs', {error_code: "404", error_message: "Videos not found"});
            const result = videos.data.videos;
            res.render('index.hbs', {results: result,next_page: next, back_page: back, find: find});
        }).catch((e) => res.status(400).send(e));
});

app.listen(port, () => {
    console.log(`Server running on ${port}`);
})