#include <jni.h>
#include <algorithm>
#include <mutex>
#include <string>
#include <vector>
#include "llama.h"

static std::mutex g_mutex;
static llama_model * g_model=nullptr;
static std::string g_model_path;

static std::string jstr(JNIEnv * env,jstring s){if(!s)return{};const char * p=env->GetStringUTFChars(s,nullptr);std::string out=p?p:"";if(p)env->ReleaseStringUTFChars(s,p);return out;}
static void unload_locked(){if(g_model){llama_model_free(g_model);g_model=nullptr;}g_model_path.clear();}
static bool ensure_model(const std::string & path,std::string & error){
    if(g_model&&g_model_path==path)return true;unload_locked();
    llama_model_params mp=llama_model_default_params();mp.n_gpu_layers=0;
    g_model=llama_model_load_from_file(path.c_str(),mp);if(!g_model){error="model laden mislukt";return false;}g_model_path=path;return true;
}

extern "C" JNIEXPORT jstring JNICALL Java_nl_tools_app_NativeLlama_generate(JNIEnv * env,jclass,jstring jpath,jobjectArray jroles,jobjectArray jcontents,jint jmax,jfloat jtemp){
    std::lock_guard<std::mutex> lock(g_mutex);std::string error,path=jstr(env,jpath);if(!ensure_model(path,error))return env->NewStringUTF(("__ERROR__:"+error).c_str());
    const jsize n=env->GetArrayLength(jroles);if(n!=env->GetArrayLength(jcontents)||n<=0)return env->NewStringUTF("__ERROR__:ongeldige berichten");
    std::vector<std::string> roles,contents;roles.reserve(n);contents.reserve(n);
    for(jsize i=0;i<n;i++){auto r=(jstring)env->GetObjectArrayElement(jroles,i);auto c=(jstring)env->GetObjectArrayElement(jcontents,i);roles.push_back(jstr(env,r));contents.push_back(jstr(env,c));env->DeleteLocalRef(r);env->DeleteLocalRef(c);}
    std::vector<llama_chat_message> msgs;msgs.reserve(n);for(jsize i=0;i<n;i++)msgs.push_back({roles[i].c_str(),contents[i].c_str()});
    const char * tmpl=llama_model_chat_template(g_model,nullptr);std::vector<char> formatted(8192);int flen=llama_chat_apply_template(tmpl,msgs.data(),msgs.size(),true,formatted.data(),formatted.size());
    if(flen>(int)formatted.size()){formatted.resize(flen+1);flen=llama_chat_apply_template(tmpl,msgs.data(),msgs.size(),true,formatted.data(),formatted.size());}
    if(flen<0)return env->NewStringUTF("__ERROR__:chat template mislukt");std::string prompt(formatted.data(),flen);
    const llama_vocab * vocab=llama_model_get_vocab(g_model);int np=-llama_tokenize(vocab,prompt.c_str(),prompt.size(),nullptr,0,true,true);if(np<=0)return env->NewStringUTF("__ERROR__:tokenisatie mislukt");
    std::vector<llama_token> tokens(np);if(llama_tokenize(vocab,prompt.c_str(),prompt.size(),tokens.data(),tokens.size(),true,true)<0)return env->NewStringUTF("__ERROR__:tokenisatie mislukt");
    llama_context_params cp=llama_context_default_params();cp.n_ctx=4096;cp.n_batch=std::min<int>(4096,std::max<int>(256,np));llama_context * ctx=llama_init_from_model(g_model,cp);if(!ctx)return env->NewStringUTF("__ERROR__:context maken mislukt");
    if(np>=llama_n_ctx(ctx)-64){llama_free(ctx);return env->NewStringUTF("__ERROR__:prompt te lang voor lokale context");}
    llama_sampler * smpl=llama_sampler_chain_init(llama_sampler_chain_default_params());llama_sampler_chain_add(smpl,llama_sampler_init_top_k(40));llama_sampler_chain_add(smpl,llama_sampler_init_top_p(0.92f,1));llama_sampler_chain_add(smpl,llama_sampler_init_temp(std::max(0.05f,(float)jtemp)));llama_sampler_chain_add(smpl,llama_sampler_init_dist(LLAMA_DEFAULT_SEED));
    llama_batch batch=llama_batch_get_one(tokens.data(),tokens.size());if(llama_decode(ctx,batch)!=0){llama_sampler_free(smpl);llama_free(ctx);return env->NewStringUTF("__ERROR__:prompt decode mislukt");}
    std::string out;int maxTokens=std::max(1,std::min(1024,(int)jmax));
    for(int i=0;i<maxTokens;i++){llama_token tok=llama_sampler_sample(smpl,ctx,-1);if(llama_vocab_is_eog(vocab,tok))break;char buf[512];int k=llama_token_to_piece(vocab,tok,buf,sizeof(buf),0,true);if(k<0){std::vector<char>b(-k);k=llama_token_to_piece(vocab,tok,b.data(),b.size(),0,true);if(k>0)out.append(b.data(),k);}else if(k>0)out.append(buf,k);batch=llama_batch_get_one(&tok,1);if(llama_decode(ctx,batch)!=0)break;}
    llama_sampler_free(smpl);llama_free(ctx);return env->NewStringUTF(out.c_str());
}

extern "C" JNIEXPORT void JNICALL Java_nl_tools_app_NativeLlama_unloadModel(JNIEnv *,jclass){std::lock_guard<std::mutex> lock(g_mutex);unload_locked();}
