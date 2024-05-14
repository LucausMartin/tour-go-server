import jieba
import jieba.analyse
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# 获取数据库中的文章
aruticles = sys.argv[1]
aruticles = [aruticles.encode('utf-8').decode('utf-8') for article in aruticles]

# 获取用户的文章
user_aruticles = sys.argv[2]
user_aruticles = [user_aruticles.encode('utf-8').decode('utf-8') for user_aruticle in user_aruticles]

# 加载停用词表
def load_stopwords(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        stopwords = [line.strip() for line in f]
    return stopwords

stopwords = load_stopwords("stopwords.txt")

# 使用jieba进行分词和关键词提取
def tokenize(text):
    words = jieba.cut(text)
    tokens = [word for word in words if word not in stopwords]
    return " ".join(tokens)

# 将用户的文章进行分词处理存进列表的每一个对象中
for user_aruticle in user_aruticles:
    user_aruticle["content"] = tokenize(user_aruticle["content"])

# 将数据库中的文章进行分词处理存进列表的每一个对象中
for article in articles:
    article["content"] = tokenize(article["content"])

# 计算用户没一篇文章的TF-IDF特征向量并放进用户文章对象中
tfidf_vectorizer = TfidfVectorizer()
for user_aruticle in user_aruticles:
    user_aruticle["tfidf"] = tfidf_vectorizer.fit_transform([user_aruticle["content"]])

# 计算数据库中每一篇文章的TF-IDF特征向量并放进数据库文章对象中
tfidf_vectorizer = TfidfVectorizer()
for article in articles:
    article["tfidf"] = tfidf_vectorizer.fit_transform([article["content"]])

# 计算用户的文章与数据库中的文章之间的余弦相似度
def calculate_similarities(user_aruticle, articles):
    similarities = []
    for article in articles:
        similarity = cosine_similarity(user_aruticle["tfidf"], article["tfidf"])[0][0]
        similarities.append({"id": article["id"], "similarity": similarity})
    return similarities

# 计算用户的每一篇文章与数据库中的文章之间的余弦相似度
for user_aruticle in user_aruticles:
    for article in articles:
        user_aruticle["similarities"] = user_aruticle["similarities"].append({
            "id": article["id"],
            "similarity": calculate_similarities(user_aruticle, articles)
        
        })

# 计算用户的文章与数据库中的文章之间的标签的相似度
def calculate_tags_similarities(user_aruticle, articles):
    # 计算两篇文章一共有多少个标签，以及有多少个相同的标签，计算比例
    user_tags_len = len(user_aruticle["tags"])
    article_tags_len = len(article["tags"])
    common_tags_len = len(set(user_aruticle["tags"]).intersection(set(article["tags"])))
    similarities = common_tags_len / (user_tags_len + article_tags_len)
    return similarities

# 计算用户的每一篇文章与数据库中的文章之间的标签相似度
for user_aruticle in user_aruticles:
    for article in articles:
        user_aruticle["tags_similarities"] = user_aruticle["tags_similarities"].append({
            "id": article["id"],
            "similarity": calculate_tags_similarities(user_aruticle, articles)
        })

# 计算现在用户文章对象里的每一篇数据库文章的相似度，按标签：余弦 是 6： 4的比例
for user_aruticle in user_aruticles:
    for article in articles:
        user_aruticle["total_similarities"] = {
            "id": article["id"],
            "similarity": user_aruticle["similarities"]["similarity"] * 0.6 + user_aruticle["tags_similarities"]["similarity"] * 0.4
        }
    # 排序
    user_aruticle["total_similarities"] = sorted(user_aruticle["total_similarities"], key=lambda x: x["similarity"], reverse=True)

# 计算用户的十篇文章的评分比例
scores = []
for user_aruticle in user_aruticles:
    scores.append(user_aruticle[scores])
scores = np.array(scores)
scores_sum = np.sum(scores)
for i in range(len(scores)):
    scores[i] = scores[i] / scores_sum

# 根据比例算出每一篇文章应该从 25 篇文章中取出的数量
num = 25
num_list = []
for score in scores:
    num_list.append(int(score * num))

# 循环用户的每一篇文章，取出 num_List 中的数量的文章
for i in range(len(user_aruticles)):
    user_aruticle = user_aruticles[i]
    user_aruticle["recommand_articles"] = []
    for j in range(len(user_aruticle["total_similarities"])):
        if num_list[j] == 0:
            break
        user_aruticle["recommand_articles"].append(user_aruticle["total_similarities"][j])
        num_list[j] -= 1

# 返回推荐的文章数组
recommand_articles = []
for user_aruticle in user_aruticles:
    recommand_articles.append(user_aruticle["recommand_articles"])

print(recommand_articles)

sys.exit(0)