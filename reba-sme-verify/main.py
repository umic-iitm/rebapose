
import flask, os, json
from flask import request

import pandas as pd


app = flask.Flask(__name__)

jsons_list = os.listdir('static/jsons/')
current_json_idx = 0

@app.route('/')
def home():
    return flask.render_template('index.html')

@app.get('/get_next_json')
def get_next_json():
    global current_json_idx
    if current_json_idx >= len(jsons_list):
        return {'error': 'No more jsons'}, 400
    is_home = request.args.get('home', 'not_home')
    if is_home != 'home':
        current_json_idx += 1
        
    json_name = jsons_list[current_json_idx]
    with open(f'static/jsons/{json_name}', 'r') as f:
        json_data = f.read()
    return json_data

@app.post('/add_score_person')
def add_score_person():
    print(request.get_json())
    post_body = request.get_json()
    with open(f'static/output/{post_body["id"]}.json', 'w') as f:
        json.dump(post_body, f, indent=2)
    return 'OK'

@app.get("/table-results")
def table():
    prnt_df = pd.DataFrame()
    cols = set()
    for file in os.listdir('static/output'):
        cols.add('annotations')
        with open(f'static/output/{file}', 'r') as f:
            data = json.load(f)
            score = data['score']
            score_new = {}
            score_new['id'] = data['id']
            score_new['annotations'] = score['annotations']
            for i in ['forehead', 'neck', 'center_hip']:
                temp_dict = {f'{i}_{k}':v for k, v in score[i].items()}
                cols.update(list(temp_dict.keys()))
                score_new.update(temp_dict)
            df = pd.DataFrame([score_new])
            prnt_df = pd.concat([prnt_df, df])
    prnt_df.reset_index(inplace=True, drop=True)
    if len(cols) > 1:
        prnt_df.loc['Total'] = pd.Series(prnt_df[list(cols)].sum())

    return flask.render_template(
        "table.html",
        table=prnt_df.to_html())

@app.delete('/delete_output_files')
def delete_output_files():
    for file in os.listdir('static/output'):
        os.remove(f'static/output/{file}')
    global current_json_idx
    current_json_idx = 0
    return 'DELETED'


@app.post('/reset-index')
def reset_index():
    global current_json_idx
    current_json_idx = 0
    return 'DONE'

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=80)
